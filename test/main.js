import { RuntimeTypeCheck } from '../script/RuntimeTypeCheck.js';
import { assert } from './lib/chai-v5-1-1.min.js';

const Cond = RuntimeTypeCheck.Cond;

describe('Types', () => {
  it('string', () => {
    assert.isOk(RuntimeTypeCheck.assert('foobar', Cond.string));
    assert.isNotOk(RuntimeTypeCheck.assert(null, Cond.string));
  });
  it('number', () => {
    assert.isOk(RuntimeTypeCheck.assert(3, Cond.number));
    assert.isNotOk(RuntimeTypeCheck.assert(false, Cond.number));
  });
  it('boolean', () => {
    assert.isOk(RuntimeTypeCheck.assert(false, Cond.boolean));
    assert.isOk(RuntimeTypeCheck.assert(true, Cond.boolean));

    assert.isNotOk(RuntimeTypeCheck.assert(undefined, Cond.boolean));
    assert.isNotOk(RuntimeTypeCheck.assert([], Cond.boolean));
  });
  it('true', () => {
    assert.isOk(RuntimeTypeCheck.assert(true, Cond.true));
    assert.isNotOk(RuntimeTypeCheck.assert(() => 3, Cond.true));
  });
  it('false', () => {
    assert.isOk(RuntimeTypeCheck.assert(false, Cond.false));
    assert.isNotOk(RuntimeTypeCheck.assert('foo', Cond.false));
  });
  it('function', () => {
    assert.isOk(RuntimeTypeCheck.assert(() => 3, Cond.function));
    assert.isNotOk(RuntimeTypeCheck.assert(3, Cond.function));
  });
});

describe('Nested conditions', () => {
  describe('Only nested', () => {
    const cond = {
      conditions: [
        Cond.typeof('array'),
        Cond.typeof('string')
      ],
      assert: val => true,
      shouldBe: { after: 'of length 1' },
      is: ({type, article}) => `${article} ${type} of a different length`
    };

    it('Nested', () => {
      assert.isOk(RuntimeTypeCheck.assert([1], cond));
      assert.isNotOk(RuntimeTypeCheck.assert(true, cond));
      assert.isNotOk(RuntimeTypeCheck.assert(null, cond));
    });
    it('String', () => {
      assert.isOk(RuntimeTypeCheck.assert('', cond));
      assert.isNotOk(RuntimeTypeCheck.assert(undefined, cond));
      assert.isNotOk(RuntimeTypeCheck.assert(() => 0, cond));
    });
  })

  describe('Length', () => {
    const cond = {
      conditions: [
        Cond.typeof('array'),
        Cond.typeof('string')
      ],
      assert: val => val.length === 1,
      shouldBe: { after: 'of length 1' },
      is: ({type, article}) => `${article} ${type} of a different length`
    };

    it('Nested', () => {
      assert.isOk(RuntimeTypeCheck.assert([1], cond));
      assert.isNotOk(RuntimeTypeCheck.assert([1, 2], cond));
      assert.isNotOk(RuntimeTypeCheck.assert([], cond));
    });
    it('String', () => {
      assert.isOk(RuntimeTypeCheck.assert('a', cond));
      assert.isNotOk(RuntimeTypeCheck.assert('ab', cond));
      assert.isNotOk(RuntimeTypeCheck.assert('', cond));
    });
  })
});
