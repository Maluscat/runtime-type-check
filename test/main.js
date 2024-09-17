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
  });

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
  });

  describe('OR', () => {
    const cond = {
      conditions: [
        Cond.typeof('array'),
        [
          Cond.string,
          Cond.keywords('f')
        ]
      ],
      assert: val => true,
      shouldBe: { after: 'of length 1' },
      is: ({type, article}) => `${article} ${type} of a different length`
    };
    it('Nested', () => {
      assert.isOk(RuntimeTypeCheck.assert([1], cond));
      assert.isOk(RuntimeTypeCheck.assert('f', cond));
      assert.isNotOk(RuntimeTypeCheck.assert('', cond));
      assert.isNotOk(RuntimeTypeCheck.assert('a', cond));
      assert.isNotOk(RuntimeTypeCheck.assert(null, cond));
    });
  });
});

describe('Message merger', () => {
  const c = {
    positive: {
      shouldBe: { before: 'positive' }
    },
    nonverbal: {
      shouldBe: { before: 'nonverbal' }
    },
    number: {
      shouldBe: { type: 'number' }
    },
    length: {
      shouldBe: { after: 'of length 5' }
    },
    foobar: {
      shouldBe: { after: 'that is a foobar' }
    },
  };
  c.integerOR = {
    conditions: [ c.number ],
    shouldBe: { type: 'integer' }
  };
  c.integerAND = {
    conditions: [[ c.number ]],
    shouldBe: { type: 'integer' }
  };
  c.negative = {
    conditions: [c.integerOR],
    shouldBe: { before: 'negative' }
  };
  c.neutral = {
    conditions: [c.negative],
    shouldBe: { before: 'neutral' }
  };
  c.baz = {
    conditions: [
      [ c.negative ],
      [ c.number, c.nonverbal ]
    ],
    shouldBe: { after: 'that has a baz' }
  };

  // neutral -> negative -> integer -> number
  // positive
  // nonverbal
  // baz
  //   -> negative -> integer -> number
  //   -> number + nonverbal
  c.or = {
    conditions: [
      [ c.neutral, c.positive ],
      [ c.baz, c.foobar, c.length ],
      [ c.nonverbal ]
    ]
  };

  it('Shallow, single', () => {
    assert.deepEqual(RuntimeTypeCheck.mergeDescriptorMessages([ c.number, c.positive ]), [{
      before: [ c.positive.shouldBe.before ],
      type: c.number.shouldBe.type,
      after: []
    }]);
    assert.deepEqual(RuntimeTypeCheck.mergeDescriptorMessages([ c.number, c.positive, c.length ]), [{
      before: [ c.positive.shouldBe.before ],
      type: c.number.shouldBe.type,
      after: [ c.length.shouldBe.after ]
    }]);
  });
  it('Shallow, multiple', () => {
    assert.deepEqual(RuntimeTypeCheck.mergeDescriptorMessages([ c.number, c.positive, c.nonverbal, c.length, c.foobar ]), [{
      type: c.number.shouldBe.type,
      before: [ c.positive.shouldBe.before, c.nonverbal.shouldBe.before ],
      after: [ c.length.shouldBe.after, c.foobar.shouldBe.after ]
    }]);
  });
  it('Deep hierarchy of ever one child = shallow', () => {
    assert.deepEqual(RuntimeTypeCheck.mergeDescriptorMessages([ c.positive, c.neutral ]), [{
      type: c.integerOR.shouldBe.type,
      before: [ c.positive.shouldBe.before, c.neutral.shouldBe.before, c.negative.shouldBe.before ],
      after: []
    }], "Deep to shallow merge");
  });
  it('Shallow OR', () => {
    assert.deepEqual(RuntimeTypeCheck.mergeDescriptorMessages([ c.positive, c.neutral ], [ c.nonverbal, c.number ]), [
      {
        type: c.integerOR.shouldBe.type,
        before: [ c.positive.shouldBe.before, c.neutral.shouldBe.before, c.negative.shouldBe.before ],
        after: []
      }, {
        before: [ 'nonverbal' ],
        type: 'number',
        after: []
      }
    ], "Shallow OR");
  });
  it('Deep OR', () => {
    assert.deepEqual(RuntimeTypeCheck.mergeDescriptorMessages(c.or), [
      {
        type: 'integer',
        before: [ c.neutral.shouldBe.before, c.positive.shouldBe.before, c.negative.shouldBe.before ],
        after: []
      }, {
        type: 'integer',
        before: [ c.negative.shouldBe.before ],
        after: [ c.baz.shouldBe.after, c.foobar.shouldBe.after, c.length.shouldBe.after ]
      }, {
        type: 'number',
        before: [ c.nonverbal.shouldBe.before ],
        after: [ c.baz.shouldBe.after, c.foobar.shouldBe.after, c.length.shouldBe.after ]
      }, {
        type: undefined,
        before: [ 'nonverbal' ],
        after: []
      }
    ], "Deep OR");
  });
  it('Deep OR: Filter duplicates', () => {
    assert.deepEqual(RuntimeTypeCheck.mergeDescriptorMessages(
      [ c.positive, c.neutral ],
      [ c.positive, c.neutral ]
    ), [{
      type: c.integerOR.shouldBe.type,
      before: [ c.positive.shouldBe.before, c.neutral.shouldBe.before, c.negative.shouldBe.before ],
      after: []
    }], "Filter duplicates");
  });
  describe('Compiled messages', () => {
    it('Deep OR', () => {
      assert.equal(RuntimeTypeCheck.getMessageExpected(c.or, c.or),
        "neutral, positive, negative integer OR negative integer of length 5 that is a foobar and has a baz OR nonverbal number of length 5 that is a foobar and has a baz OR nonverbal <unknown>");
    });
  });
});

// describe('Type messages', () => {
//   it('Multiple dependent conditions', () => {
//     assert.throws(RuntimeTypeCheck.assertAndThrow(0, [ Cond.length(12) ]), '');
//   });
// });
