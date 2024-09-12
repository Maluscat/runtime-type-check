'use strict';
export type Article = 'a' | 'an';
export type Type =
  | 'array' | 'NaN' | 'null' | 'string' | 'number' | 'bigint'
  | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function';
/**
 * Data describing attributes of a value that did not pass
 * a condition's assertion. Utilized in {@link Condition.is}.
 */
export interface IsData {
  val: any;
  type: Type;
  article: Article;
  conditions: Condition[];
}
export interface ExpectedData {
  type: string;
}
/**
 * Contains the three parts of the message used to denote the
 * expected type of the form "[before] [type] [after]".
 *
 * Message parts from extended conditions (via {@link Condition.conditions})
 * will be inherited and merged.
 *
 * @example
 * Extending {@link RuntimeTypeCheck.Cond.number} will inherit its
 * `type` as `"number"`. Building a `before: "positive"` on top of
 * it will create the following MessagePart:
 * ```ts
 * {
 *   before: 'positive',
 *   type: 'number',
 * }
 * ```
 * And yield the following sentence: `"Expected positive number [...]"`.
 */
export interface MessagePart {
  before: string;
  type: string;
  after: string;
}

export interface Condition {
  /**
   * Further conditions that this condition relies on. The passed value
   * in {@link assert} is ensured to match these conditions.
   *
   * Note that this is a {@link Descriptor}, so it is an OR list of AND lists.
   *
   * For example, a condition asserting a positive number
   * may specify the condition of type number.
   */
  conditions?: Descriptor;
  /**
   * Assertion function for an arbitrary value.
   *
   * The passed value is ensured to match the specified
   * {@link Descriptor} in {@link Condition.conditions}, if any.
   */
  assert: (value: any) => boolean;
  /**
   * Denote what the expected value should be.
   * @see {@link MessagePart}.
   *
   * @example
   * Assuming the condition asserts a positive number and specifies the
   * further condition {@link RuntimeTypeCheck.Cond.number}.
   * The attribute "positive" can then simply be added to the front of the type.
   * The type itself ("number") is contributed by the extended condition,
   * so we don't have to care about that:
   *
   * `shouldBe: { before: 'positive' }`
   *
   * The final error message will then be:
   * "Expected positive number, got [...]."
   */
  shouldBe: Partial<MessagePart> | ((data: ExpectedData) => Partial<MessagePart>);
  /**
   * Sentence denoting what the value is when it does not assert.
   * In simple cases, this is usually a description of the opposite
   * of the assertion. The sentence should always start with a lowercase
   * indefinite article (a or an). 
   *
   * For advanced use cases, a function may be specified which takes
   * an {@link IsData} object that contains useful information about
   * the value in question.
   *
   * @example Simple
   * Assuming the condition asserts a positive number, the `is`
   * value could be "a negative number or 0", which is a
   * description of the exact opposite of the expected value.
   *
   * The final error message will then be:
   * "Expected [...], got a negative number or 0."
   *
   * @example Advanced
   * Assuming the condition asserts the length of a value and
   * the specified further conditions are therefore
   * {@link RuntimeTypeCheck.Cond.array} and {@link RuntimeTypeCheck.Cond.string}.
   *
   * The type or value of the value are unknown, so we can utilize the
   * method to get type and article and append a sentence describing
   * the value:
   * ```js
   * ({ type, article }) => `${article} ${type} of a different length`.
   * ```
   *
   * In case of an array, the final error message will then be:
   * "Expected [...], got an array of a different length"
   */
  is: string | ((data: IsData) => string);
}

/**
 * List of possible conditions, *any* of which may match.
 * Thus, it is a disjunction of conjunctions (OR list of AND lists).
 */
export type Descriptor = ConditionList[];
/**
 * Either a single condition that must match, or
 * a list of conditions, *all* of which must match.
 */
export type ConditionList = Condition | Condition[];


export class TypeCheckError extends Error {
  expected;
  is;

  constructor(expected: string, is: string) {
    super(`Expected ${expected}, got ${is}`);
    this.expected = expected;
    this.is = is;
    this.name = this.constructor.name;
  }
}

export class RuntimeTypeCheck {
  static #conditionTypeof(type: string): Condition {
    return {
      assert: val => RuntimeTypeCheck.getType(val) === type,
      shouldBe: { type: type },
      is: ({type}) => type
    };
  }

  static Cond = ({
    typeof: this.#conditionTypeof,
    boolean: this.#conditionTypeof('boolean'),
    function: this.#conditionTypeof('function'),
    number: this.#conditionTypeof('number'),
    string: this.#conditionTypeof('string'),
    array: (...descriptor: Descriptor) => {
      return {
        conditions: [this.#conditionTypeof('array')],
        assert: (val: any[]) => descriptor.length > 0
          ? val.every(inner => this.assert(inner, ...descriptor))
          : true,
        shouldBe: descriptor.length > 0
          ? { type: `Array<${this.getMessageExpected(...descriptor)}>` }
          : { type: 'array' },
        is: ({val, type}) => {
          if (type === 'array' && descriptor.length > 0) {
            if (val.length === 0) {
              return 'an empty array';
            } else {
              return `Array<${this.getMessageIsIterated(val, ...descriptor)}>`
            }
          } else return type;
        }
      };
    },
    object: (keyName: string, ...descriptor: Descriptor) => {
      if (typeof keyName !== 'string') throw new Error(`\
Condition 'object': When passing a descriptor, the first parameter \
needs to be a key name, which is used for displaying "Object<keyName, ...>" in the type message.
(If generic, just use 'string')`);

      return {
        conditions: [this.#conditionTypeof('object')],
        assert: val => descriptor
          ? Object.values(val).every(inner => this.assert(inner, ...descriptor))
          : true,
        shouldBe: descriptor
          ? { type: `Object<${keyName}, ${this.getMessageExpected(...descriptor)}>` }
          : { type: 'object' },
        is: ({val, type}) => {
          if (type === 'object' && descriptor) {
            if (val.length === 0) {
              return 'an empty object';
            } else {
              return `Object<${this.getMessageIsIterated(Object.values(val), ...descriptor)}>`
            }
          } else return type;
        }
      };
    },
    true: {
      conditions: [this.#conditionTypeof('boolean')],
      assert: val => val === true,
      shouldBe: { type: 'true' },
      is: 'false',
    },
    false: {
      conditions: [this.#conditionTypeof('boolean')],
      assert: val => val === false,
      shouldBe: { type: 'false' },
      is: 'true',
    },
    integer: {
      conditions: [this.#conditionTypeof('number')],
      assert: val => val % 1 === 0,
      shouldBe: { type: 'integer' },
      is: 'a floating point number'
    },
    nonnegative: {
      conditions: [this.#conditionTypeof('number')],
      assert: val => val >= 0,
      shouldBe: { before: 'non-negative' },
      is: 'a negative number'
    },
    positive: {
      conditions: [this.#conditionTypeof('number')],
      assert: val => val > 0,
      shouldBe: { before: 'positive' },
      is: 'a negative number or 0'
    },
    nonempty: {
      conditions: [
        this.#conditionTypeof('array'),
        this.#conditionTypeof('string')
      ],
      assert: val => val.length > 0,
      shouldBe: { before: 'non-empty' },
      is: ({type, article}) => `${article} empty ${type}`
    },
    keywords: (...keywords: string[]) => {
      return {
        conditions: [this.#conditionTypeof('string')],
        assert: val => keywords.includes(val),
        shouldBe: {
          type: keywords.length > 1
            ? `one of the keywords ${this.getPrettyEnumeratedList(keywords)}`
            : `the keyword "${keywords[0]}"`
        },
        is: 'a different string'
      }
    },
    length: (len: number) => {
      return {
        conditions: [
          this.#conditionTypeof('array'),
          this.#conditionTypeof('string')
        ],
        assert: val => val.length === len,
        shouldBe: ({type}) => ({ type, after: `of length ${len}` }),
        is: ({type, article}) => `${article} ${type} of a different length`
      };
    },
    range: (min: number, max: number) => {
      return {
        conditions: [this.#conditionTypeof('number')],
        assert: val => val >= min && val <= max,
        shouldBe: ({type}) => ({ type: type, after: `of the interval [${min}, ${max}]` }),
        is: 'a number outside of the required range'
      }
    }
  }) as const satisfies Record<string, Condition | ((...args: any[]) => Condition)>


  /**
   * Assert an arbitrary value to match *any* of the given conditions
   * and throw a detailed explanatory error message if the assertion fails.
   *
   * The conditions are tested recursively through their
   * potential {@link Condition.conditions} field.
   *
   * @param val The value to test.
   * @param descriptor The conditions to test the value against.
   */
  static assertAndThrow(val: any, ...descriptor: Descriptor) {
    if (!this.assert(val, ...descriptor)) {
      throw new TypeCheckError(
        this.getMessageExpected(...descriptor),
        this.getMessageIs(val, ...descriptor)
      );
    }
  }
  /**
   * Assert an arbitrary value to match *any* of of the given conditions.
   *
   * The conditions are tested recursively through their
   * potential {@link Condition.conditions} field.
   *
   * @param val The value to test.
   * @param descriptor The conditions to test the value against.
   */
  static assert(val: any, ...descriptor: Descriptor): boolean {
    return descriptor.some(condList => {
      condList = this.#resolveConditionList(condList);
      for (const cond of condList) {
        if (cond.conditions) {
          const res = this.assert(val, ...cond.conditions);
          if (!res) return res;
        }
      }
      return condList.every(cond => cond.assert(val));
    });
  }

  /**
   * If a given arbitrary value does not assert *any* of the given
   * conditions, return the failing condition that is the closest
   * to passing, or undefined otherwise.
   *
   * The conditions are tested recursively through their
   * potential {@link Condition.conditions} field.
   *
   * @param val The value to test.
   * @param descriptor The conditions to test the value against.
   */
  static assertFind(val: any, ...descriptor: Descriptor): Condition | undefined {
    let max = -1;
    let maxCondition: Condition[] | undefined;
    for (let condList of descriptor) {
      if (this.assert(val, condList)) return;

      condList = this.#resolveConditionList(condList);
      const assertCount = this.getDescriptorPassCount(val, [condList]);
      if (assertCount > max) {
        maxCondition = condList;
        max = assertCount;
      }
    }
    return maxCondition?.find(cond => !cond.assert(val));
  }
  /**
   * Recursively count the amount of passing conditions
   * inside a given descriptor and return it.
   *
   * This does *not* check if a descriptor as a whole asserts to true.
   *
   * @remarks
   * Contrary to most other methods, this method does *not* take its
   * descriptor as a rest parameter. A descriptor that would otherwise
   * be spreaded must be passed inside an array (sorry).
   */
  static getDescriptorPassCount(val: any, descriptorList: Descriptor, ignoreConditions: Condition[] = []): number {
    let count = 0;
    for (let condList of descriptorList) {
      condList = this.#resolveConditionList(condList);
      for (const cond of condList) {
        if (!ignoreConditions.includes(cond)) {
          ignoreConditions.push(cond);
          if (cond.conditions) {
            count += this.getDescriptorPassCount(val, cond.conditions, ignoreConditions);
          }
          count += cond.assert(val) ? 1 : 0;
        }
      }
    }
    return count;
  }

  /**
   * Return the result of {@link getMessageIs} for the first
   * of the passed values that does not assert.
   *
   * @param val An **array** of the values to test.
   * @param descriptor The conditions to test the value against.
   */
  static getMessageIsIterated(val: any[], ...descriptor: Descriptor) {
    for (const item of val) {
      if (!this.assert(item, ...descriptor)) {
        return this.getMessageIs(item, ...descriptor);
      }
    }
  }
  /**
   * Return a string denoting the type of the value in the
   * context of the first failed condition, or an empty string
   * if all conditions assert correctly.
   *
   * The returned string is simply the result of executing the
   * {@link Condition.is} field of the failing condition.
   *
   * @example
   * Value:        0
   * Conditions:   [ Cond.number, Cond.positive ]
   * Return value: "a negative number or 0"
   *
   * @param val The value to test.
   * @param descriptor The conditions to test the value against.
   *                   The first failed condition will produce the return value.
   */
  static getMessageIs(val: any, ...descriptor: Descriptor): string {
    for (let condList of descriptor) {
      condList = this.#resolveConditionList(condList);

      const condition = this.assertFind(val, condList);
      if (!condition) continue;

      if (typeof condition.is === 'function') {
        const valueType = this.getType(val);
        return condition.is({
          type: valueType,
          val: val,
          article: this.getArticle(valueType),
          conditions: condList
        } as IsData);
      }
      return condition.is;
    }
    return '';
  }

  /**
   * Return a string denoting the expected type within the passed conditions.
   *
   * @example
   * descriptor 1: [ Cond.number, Cond.positive ]
   * descriptor 2: Cond.keywords("foobar")
   * Return value: `positive number OR the keyword "foobar"`
   */
  static getMessageExpected(...descriptor: Descriptor) {
    let output = '';
    descriptor.forEach((condList, i, arr) => {
      output += this.#joinMessage(this.#getTypeMessageExpected(condList));
      if (i !== arr.length - 1) {
        output += ' OR ';
      }
    });
    return output;
  }
  static #getTypeMessageExpected(condList: ConditionList): MessagePart {
    condList = this.#resolveConditionList(condList);
    const message: MessagePart = {
      before: '',
      type: '',
      after: '',
    };

    for (const cond of condList) {
      if (cond.conditions) {
        for (const deepCond of cond.conditions) {
          const deepMessage = this.#getTypeMessageExpected(deepCond);
          mergeMessages(message, deepMessage);
        }
      }

      let expected: Partial<MessagePart>;
      if (typeof cond.shouldBe === 'function') {
        expected = cond.shouldBe({
          type: message.type
        });
      } else {
        expected = cond.shouldBe;
      }
      mergeMessages(message, expected);
    }

    return message;


    function mergeMessages(target: MessagePart, source: Partial<MessagePart>) {
      if (source.before) target.before += source.before;
      if (source.type) target.type = source.type;
      if (source.after) target.after = source.after + message.after;
    }
  }

  // ---- Helper functions ----
  /** Uppercase the first character of a passed string. */
  static toTitleCase(str: string) {
    return str.slice(0, 1).toUpperCase() + str.slice(1);
  }

  /**
   * Get the matching indefinite article (a or an) for the passed string.
   *
   * @remarks
   * This method is by no means linguistically sound, it simply checks
   * whether the first character of the passed string is a vowel.
   */
  static getArticle(value: string) {
    return /^[aeiou]/i.test(value) ? 'an' : 'a';
  }

  /**
   * Get a string list of all items of the passed string array
   * of the style "first, second, third or fourth".
   *
   * @remarks
   * This is used within the {@link RuntimeTypeCheck.Cond.keywords} condition.
   */
  static getPrettyEnumeratedList(list: string[]) {
    return list.reduce((acc, word, i) => {
      if (i !== 0 && i === list.length - 1) {
        acc += ' or ';
      } else if (i !== 0) {
        acc += ', ';
      }
      return acc + `"${word}"`;
    }, '');
  }

  /**
   * Return the `typeof` of a value with the
   * additional types 'array', 'NaN' and 'null'.
   */
  static getType(value: any): Type {
    if (Array.isArray(value))
      return 'array';
    else if (Number.isNaN(value))
      return 'NaN';
    else if (value === null)
      return 'null';
    else
      return typeof value;
  }

  // ---- Internal type resolvers ----
  /**
   * Return a passed condition list (which can be both an
   * array or a single item) as an ensured array.
   */
  static #resolveConditionList(condList: ConditionList): Condition[] {
    return Array.isArray(condList) ? condList : [condList];
  }

  static #joinMessage(message: MessagePart): string {
    message.before &&= (message.before + ' ');
    message.after &&= (' ' + message.after);
    return message.before + message.type + message.after;
  }
}
