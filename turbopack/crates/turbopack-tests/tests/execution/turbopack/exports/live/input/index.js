import { foo, setFoo, bar, setBar } from './live_exports.js'
import * as ns from './live_exports.js'

it('hoisted declarations are live', () => {
  expect(bar()).toBe('bar')
  setBar(() => 'patched')
  expect(bar()).toBe('patched')
})

it('exported lets are live', () => {
  expect(foo).toBe('foo')
  setFoo('new')
  expect(foo).toBe('new')
})

it('exported bindings that are not mutated are not live', () => {
  expect(Object.getOwnPropertyDescriptor(ns, 'obviouslyneverMutated')).toEqual(
    expect.objectContaining({
      enumerable: true,
      configurable: false,
    })
  )
  expect(Object.getOwnPropertyDescriptor(ns, 'neverMutated')).toEqual(
    expect.objectContaining({
      enumerable: true,
      configurable: false,
    })
  )
})
