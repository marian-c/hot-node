import * as chokidar from 'chokidar'
const Module = require('module')

const __require = Module.prototype.require
const __load = Module.prototype.load
let watcher: chokidar.FSWatcher

export interface HotNodeOptions {
  silentRequireError?: boolean
  noExceptionCatch?: boolean
}

export type AcceptCallback = (err: any) => void

export interface HotNodeModule extends NodeModule {
  hot: {
    accept: (callback?: AcceptCallback) => void
  }
}

type AcceptMap = { [moduleName: string]: AcceptCallback }

const dependantsMap: { [moduleName: string]: string[] } = {}
const emptyCallback = () => { }
const entryModule = process.argv[1]

export function register(options?: HotNodeOptions) {
  options = options || {}
  const isEligible = (moduleName: string) => {
    const slashes = /\/|(\\)/
    return !/node_modules/.test(moduleName) && slashes.test(moduleName)
  }

  const acceptMap: AcceptMap = {}
  const isAccepted = (moduleName: string) => !!acceptMap[moduleName]

  Module.prototype.load = function (this: HotNodeModule, moduleName: string) {
    if (isEligible(moduleName)) {
      watcher.add(moduleName)
      if (this.hot) {
        // TODO: REMOVE LATER, if will not appear anywhere
        console.warn('load module, already hot', module)
      }
      this.hot = {
        accept: (callback?: AcceptCallback) => {
          acceptMap[moduleName] = callback || emptyCallback
        }
      }
    }
    __load.call(this, moduleName)
  }

  Module.prototype.require = function (this: HotNodeModule, p: any) {
    const moduleName = Module._resolveFilename(p, this)
    delete acceptMap[moduleName]
    const module = __require.call(this, p)
    watcher.add(moduleName)
    const moduleDependants = dependantsMap[moduleName] || []
    moduleDependants.push(this.filename)
    dependantsMap[moduleName] = moduleDependants
    return module
  }

  const deleteModule = (moduleName: string) => {
    delete dependantsMap[moduleName]
    delete require.cache[moduleName]
    watcher.unwatch(moduleName)
  }

  const findDependantsToReload = (moduleName: string, modulesToReload: AcceptMap) => {
    if (acceptMap[moduleName]) {
      modulesToReload[moduleName] = acceptMap[moduleName]
    } else {
      const dependants = dependantsMap[moduleName] || []
      dependants.forEach(dependant => {
        findDependantsToReload(dependant, modulesToReload)
      })
    }
    deleteModule(moduleName)
  }

  if (watcher) { watcher.close() }


  watcher = chokidar.watch([], { usePolling: true, persistent: true })
    .on('change', (moduleName: string) => {
      const modulesToReloadMap: AcceptMap = {}

      findDependantsToReload(moduleName, modulesToReloadMap)
      const modulesToReload = Object.keys(modulesToReloadMap)
      // reload entry in this case
      if (!modulesToReload.length) {
        modulesToReload.push(entryModule)
        modulesToReloadMap[entryModule] = acceptMap[entryModule] || emptyCallback
      }
      console.log('modulesToReload', modulesToReload)
      modulesToReload.forEach((moduleName) => {
        const acceptCallback = modulesToReloadMap[moduleName]
        let error = null
        try {
          require(moduleName)
        } catch (e) {
          // restore acceptMap
          Object.assign(acceptMap, modulesToReloadMap)
          error = e

          if (!options!.silentRequireError) {
            console.error('hot-node: error while module reload', e)
          }
        }
        acceptCallback(error)
      })
    })

  if (!options!.noExceptionCatch) {
    process.on('uncaughtException', function (err: any) {
      console.error('hot-node: uncaught exception', err.stack || err)
      Object.keys(acceptMap)
        .filter(moduleName => moduleName !== entryModule)
        .forEach((m) => delete acceptMap[m])
    })
  }
}

