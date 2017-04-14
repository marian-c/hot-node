### ncl (ycl)

> Copies npm/yarn linked modules to your project.

## Why

Because uisng [symlinked packages](https://docs.npmjs.com/cli/link) while development often brings a lot of troubles, with dependencies resolution, etc...

## Install

![npm (scoped)](https://img.shields.io/npm/v/ncl.svg?maxAge=86400)

```
  npm i ncl -g
```


## Usage 

It adds two commands to cli: 
  - `ncl` for dealing with npm's client global/linked modules
  - `ycl` for dealing with yarn's linked modules


```
ycl [options] module1 [module2...]

Options:
  --empty         cleans up destignation module directory before copying
                                                                       [boolean]
  --no-npmingore  do not read .npmignore
  --help          Show help                                            [boolean]

Examples:
  ycl my-module                 - simple copy
  ycl --empty mongoose express  - empty destignation directory before
```