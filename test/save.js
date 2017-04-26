'use strict'

const mkdirp = require('mkdirp').sync
const rimraf = require('rimraf').sync
const Persist = require('../')
const test = require('tape')
const path = require('path')
const fs = require('fs')

const folderName = 'data'
const bucketName = 'bucket'
const localPath = path.resolve(__dirname, folderName)
const bucketPath = path.resolve(localPath, bucketName)

class CustomPersister {
  constructor(opts) {
    this.values = {}
    opts.initial.forEach((obj) => {
      this.values[obj.name] = String(obj.value)
    })
  }

  save(value) {
    this.values.file = value

    return Promise.resolve()
  }

  load() {
    return Promise.resolve(this.values.file)
  }
}

let persist

function reset(persisters) {
  rimraf(localPath)
  mkdirp(bucketPath)

  persist = new Persist(persisters)
}

test('local save', (t) => {
  t.plan(1)

  reset([
    {
      type: 'local',
      path: `${localPath}/file`
    }
  ], [
    { path: `${localPath}/file`, value: '1234' }
  ])

  persist
    .save('1234')
    .then(() => {
      const readValue = fs.readFileSync(path.resolve(`${localPath}/file`), { encoding: 'utf8' })
      t.equal(readValue, '1234')
    })
})

test('s3 save', (t) => {
  t.plan(1)

  reset([
    {
      type: 's3',
      localPath,
      bucket: bucketName,
      key: 'file'
    }
  ], [
    { path: `${bucketPath}/file`, value: '1234' }
  ])

  persist
    .save('1234')
    .then(() => {
      const readValue = fs.readFileSync(path.resolve(`${bucketPath}/file`), { encoding: 'utf8' })
      t.equal(readValue, '1234')
    })
})

test('s3 + local save', (t) => {
  t.plan(2)

  reset([
    {
      type: 's3',
      localPath,
      bucket: bucketName,
      key: 'file'
    },
    {
      type: 'local',
      path: `${localPath}/file`
    }
  ], [
    { path: `${bucketPath}/file`, value: '1234' },
    { path: `${localPath}/file`, value: '1234' }
  ])

  persist
    .save('1234')
    .then(() => {
      const localValue = fs.readFileSync(path.resolve(`${localPath}/file`), { encoding: 'utf8' })
      t.equal(localValue, '1234')

      const s3Value = fs.readFileSync(path.resolve(`${bucketPath}/file`), { encoding: 'utf8' })
      t.equal(s3Value, '1234')
    })
})

test('s3 + local + custom save', (t) => {
  t.plan(3)

  const custom = new CustomPersister({
    initial: [
          { name: 'file', value: '1234' }
    ]
  })

  reset([
    {
      type: 's3',
      localPath,
      bucket: bucketName,
      key: 'file'
    },
    {
      type: 'local',
      path: `${localPath}/file`
    },
    {
      type: 'custom',
      implementation: custom
    }
  ], [
    { path: `${bucketPath}/file`, value: '1234' },
    { path: `${localPath}/file`, value: '1234' }
  ])

  persist
    .save('1234')
    .then(() => {
      const localValue = fs.readFileSync(path.resolve(`${localPath}/file`), { encoding: 'utf8' })
      t.equal(localValue, '1234')

      const s3Value = fs.readFileSync(path.resolve(`${bucketPath}/file`), { encoding: 'utf8' })
      t.equal(s3Value, '1234')

      custom.load().then((val) => {
        t.equal(val, '1234')
      })
    })
})
