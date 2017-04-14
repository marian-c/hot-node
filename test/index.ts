import * as fs from 'fs-extra'
import * as path from 'path'
import { equal } from 'assert'
import { register } from '..'

const tmpDir = __dirname + '/tmp'

const modifyFile = (fileName: string) =>
  fs.writeFileSync(path.join(tmpDir, fileName),
    fs.readFileSync(path.join(tmpDir, fileName), 'utf-8') + '\n "changed"')

export interface HotTestGlobal {
  entry: number,
  acceptedModule: number,
  notAcceptedSubmodule: number,
  notAcceptedSubmoduleLevelTwo: number,
  acceptedCallback?: number
}

export const hotGlobal: HotTestGlobal = global as any

const moduleNames: {[key in keyof HotTestGlobal]: string} = {
  entry: './entry.js',
  acceptedModule: './accepted-module.js',
  notAcceptedSubmodule: './not-accepted-submodule.js',
  notAcceptedSubmoduleLevelTwo: './not-accepted-submodule-level-too.js'
}

const moduleSources = {
  [moduleNames.entry]: `
    require('${moduleNames.acceptedModule}')
    global.entry = (global.entry || 0) + 1
    if (module.hot) module.hot.accept()
  `,
  [moduleNames.acceptedModule]: `
    require('${moduleNames.notAcceptedSubmodule}')
    global.acceptedModule = (global.acceptedModule || 0) + 1
    if (module.hot) module.hot.accept(() => 
      global.acceptedCallback = (global.acceptedCallback || 0) + 1
    )
  `,
  [moduleNames.notAcceptedSubmodule]: `   
    require('${moduleNames.notAcceptedSubmoduleLevelTwo}')
    global.notAcceptedSubmodule = (global.notAcceptedSubmodule || 0) + 1
  `,
  [moduleNames.notAcceptedSubmoduleLevelTwo]: `       
    global.notAcceptedSubmoduleLevelTwo = (global.notAcceptedSubmoduleLevelTwo || 0) + 1
  `

}

const writeSources = () => {
  Object.keys(moduleSources).forEach((moduleName) =>
    fs.writeFileSync(path.join(tmpDir, moduleName), moduleSources[moduleName])
  )
}

describe('Hot Node', () => {
  before((done) => {
    fs.emptyDirSync(tmpDir)
    writeSources()
    register()
    require(path.join(tmpDir, moduleNames.entry))
    setTimeout(done, 500)
  })

  describe('Change of not accepted module', function () {
    this.timeout(2500)
    before((done) => {
      modifyFile(moduleNames.notAcceptedSubmoduleLevelTwo)
      setTimeout(done, 1500)
    })

    it('reloads changed module', () => {
      equal(hotGlobal.notAcceptedSubmoduleLevelTwo, 2)
    })

    it('reloads dependant module, that not accepted', () => {
      equal(hotGlobal.notAcceptedSubmodule, 2)
    })

    it('reloads dependant module, that is accepted', () => {
      equal(hotGlobal.acceptedModule, 2)
    })

    it('calls accepted module callback', () => {
      equal(hotGlobal.acceptedCallback, 1)
    })

    it('does not reload parent of dependant accepted module', () => {
      equal(hotGlobal.entry, 1)
    })
  })

  describe('Change of accepted module', function () {
    this.timeout(2500)
    before((done) => {
      modifyFile(moduleNames.acceptedModule)
      setTimeout(done, 1500)
    })

    it('does not reload dependencies (level two)', () => {
      equal(hotGlobal.notAcceptedSubmoduleLevelTwo, 2)
    })

    it('does not reload dependencies', () => {
      equal(hotGlobal.notAcceptedSubmodule, 2)
    })

    it('reloads changed accepted module', () => {
      equal(hotGlobal.acceptedModule, 3)
    })

    it('calls accepted module callback', () => {
      equal(hotGlobal.acceptedCallback, 2)
    })

    it('does not reload parent of dependant accepted module', () => {
      equal(hotGlobal.entry, 1)
    })
  })

  describe('Change of entry module', function () {
    this.timeout(2500)
    before((done) => {
      modifyFile(moduleNames.entry)
      setTimeout(done, 1500)
    })

    it('reload accepted entry point', () => {
      equal(hotGlobal.entry, 2)
    })
  })

  after(() => {
    fs.emptyDirSync(tmpDir)    
  })
})