# RuntimeTypeCheck
Minimal, modular type checker for the runtime with a heavy focus on producing
readable and smart error messages.



## Installation
Since this library is completely runtime agnostic, it can be used inside any
JavaScript environment, including the web.

### Download
The only required file is `RuntimeTypeCheck.js` inside the [`script`](./script)
folder. If you want type checking, fetch `RuntimeTypeCheck.d.ts` as well!

### npm
Available on npm under `@maluscat/runtime-type-check`. Use your favorite package manager:
```sh
yarn add @maluscat/runtime-type-check
bun install @maluscat/runtime-type-check
npm install @maluscat/runtime-type-check
```


## Concepts
The core concept of RuntimeTypeCheck is a `Condition`, which is a building
block that contains assertion information. Conditions can recursively extend
other conditions and can be combined "OR" and "AND" wise.

This allows an overarching assertion to be split up into multiple smaller
conditions, ensuring flexibility and reusability. This means that conditions
are able to focus on only one part of an assertion while safely assuming the
passed value to already match various other layers.
For example, a condition `divisible(n)` could extend the condition
`number` and can thus safely assume that any passed value is a number.

So, if we want to assert a value to be a positive number divisible by 5,
we can AND-combine two assertions `positive` and `divisible(5)`, both of which
will extend the condition `number` (see the [examples](#examples) below).


### Condition
The TS type of a condition looks like this:
```ts
interface Condition {
  /** Assertion function. */
  assert: (value: any) => boolean;
  /**
   * Conditions that this condition relies on.
   * Note that this field is a Descriptor, so an "OR" list of "AND" conditions.
   */
  conditions?: Descriptor;
  /**
   * Description of what the correct type should be.
   *
   * This will be merged with other conditions to form a coherent sentence
   * of the desired type (e.g. "Expected a positive number of length 5").
   */
  shouldBe: Message;
  /**
   * Generic description of any value that does **not** assert,
   * so the opposite of what is asserted for.
   *
   * E.g. "a floating point number" when asserting an integer.
   */
  is: string | ((data: IsData) => string);
}
```
where
```ts
/** Will be merged into a sentence of the form "...before type ...after" */
interface Message {
  /** Will be put before the type (e.g. "positive") */
  before?: string;
  /** A noun (e.g. "integer" or "string") */
  type?: string;
  /** Will be put after the type (e.g. "of length 5") */
  after?: string;
}
interface IsData {
  val: any;
  type: Type;
  article: 'a' | 'an';
}
type Type =
  | 'array' | 'NaN' | 'null' | 'string' | 'number' | 'bigint'
  | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function';
```

See below for a more detailed overview with examples, and the [docs](#docs)
for more in-depth descriptions.


## Usage
The only non-typing-related exports are `RuntimeTypeCheck` (main library),
`Cond` (predefined conditions) and, if needed, `TypeCheckError` (thrown by
`assertAndThrow`):
```js
import { RuntimeTypeCheck, Cond, TypeCheckError } from '@maluscat/runtime-type-check';
```
See the [docs](#docs) for an overview of all additional typing related exports
for use in TypeScript.

`RuntimeTypeCheck` is an entirely static class. For most use cases, there are
only two relevant methods: `assert` (returns boolean) and `assertAndThrow`
(throws an explanatory error message when it does not assert).

### Parameters
**Every method accepts its conditions as a rest parameter**, *any*
of which may assert (OR). One parameter can either be a single
condition or an AND array of conditions.

Hence, this matches either a string OR a number:
```ts
RuntimeTypeCheck.assert(3, Cond.string, Cond.number)
```
Whereas this matches a positive number:
```ts
RuntimeTypeCheck.assert(3, [ Cond.positive, Cond.number ])
```

This also applies to the `conditions` parameter of a `Condition`.

### `assert(value, ...descriptor)`
Returns a boolean of whether the passed value matches the passed descriptor.

### `assertAndThrow(value, ...descriptor)`
If the given value does not assert, `assertAndThrow` throws an error message
that automatically catches the most relevant condition in the context of the
given value. So, when asserting, say, either a string or a positive integer
against the value `-3`, the method will explain that the given *number* may
not be negative. See the [examples](#examples) for a more detailed overview.

If you need to modify or catch a potentially thrown error, it is good practice
to test the caught error for an instance of `TypeCheckError`.
You can then use its `message` field as-is or access the two parts of the
message: `is` and `expected`:
```ts
try {
  RuntimeTypeCheck.assertAndThrow(-3, Cond.string, Cond.false);
} catch (err) {
  if (err instanceof TypeCheckError) {
    // message:  "Expected string OR false, got number"
    // expected: "string OR false"
    // is:       "number"
    console.log(err.expected, err.is, err.message);
  } else throw err;
}
```


### `Cond`
`Cond` (alias: `RuntimeTypeCheck.Cond`) pre-defines commonly used conditions.
See an overview in the [docs](#docs).

There are also [additional conditions](#additional-conditions) included below
that have not made it into the library.


## Examples
### Using provided `Cond`
Let's assert a value to be either a positive integer or a string. For this,
the conditions provided by the [`Cond`](https://docs.malus.zone/runtime-type-check/#Cond)
class can be used.
```js
import { RuntimeTypeCheck, Cond } from '@maluscat/runtime-type-check';

// true
RuntimeTypeCheck.assert('foobar', Cond.string, [ Cond.positive, Cond.integer ]);

// false (not positive)
RuntimeTypeCheck.assert(-3, Cond.string, [ Cond.positive, Cond.integer ]);

// TypeCheckError: "Expected positive integer OR string, got a negative number or 0"
RuntimeTypeCheck.assertAndThrow(-3, Cond.string, [ Cond.positive, Cond.integer ]);
```

### Array with inner type
`Cond` also provides conditions for array and object (both of which are functions!)
that can take a descriptor of their inner values:
```js
// true
RuntimeTypeCheck.assertAndThrow([ 'foobar' ], Cond.array(Cond.string))

// TypeCheckError: "Expected Array<string>, got number"
RuntimeTypeCheck.assertAndThrow(5, Cond.array(Cond.string))
```

Because of the conditions' dynamic nature, this can be nested and combined:
```js
// true for both (Array<string[], number>)
RuntimeTypeCheck.assertAndThrow([['foobar']], Cond.array(Cond.array(Cond.string), Cond.number));
RuntimeTypeCheck.assertAndThrow([69], Cond.array(Cond.array(Cond.string), Cond.number));

// TypeCheckError: "Expected Array<Array<string> OR number>, got number"
RuntimeTypeCheck.assertAndThrow(5, Cond.array(Cond.array(Cond.string), Cond.array));
```

### Defining custom conditions
Now we want to assert a number that's divisible by 5 and is greater than 25.
The builtin `Cond` does not provide any help here, so we can define the
required conditions ourselves.

Both conditions should extend `Cond.number` to be sure that any incoming
values are already numbers.
We will also take the liberty and make both of them a generic generator:
```ts
const divisibleBy = (value) => ({
  conditions: [ Cond.number ], // Ensure that it's a number
  assert: (val: number) => val % value === 0,
  shouldBe: { after: `that is divisible by ${value}` },
  is: `a number not divisible by ${value}`
} satisfies Condition) as Condition;

const greaterThan = (value) => ({
  conditions: [ Cond.number ],
  assert: (val: number) => val > value,
  shouldBe: { after: `that is greater than ${value}` },
  is: `a number less than or equal to ${value}`
} satisfies Condition) as Condition;
```
We can now instantiate these functions to generate the conditions we want
and combine them:
```ts
const divisibleBy5 = divisibleBy(5);
const greaterThan25 = greaterThan(25);

const divisibleBy5AndGreaterThan25 = [ divisibleBy5, greaterThan25 ];
```
Now the condition is usable anywhere.
```js
// true
RuntimeTypeCheck.assertAndThrow(30, divisibleBy5AndGreaterThan25);

/*
* TypeCheckError:
*   Expected number that is divisible by 5 and is greater than 25,
*   got a number less than or equal to 25
*/
RuntimeTypeCheck.assertAndThrow(25, divisibleBy5AndGreaterThan25);

/*
* TypeCheckError:
*   Expected number that is divisible by 5 and is greater than 25,
*   got a number not divisible by 5
*/
RuntimeTypeCheck.assertAndThrow(26, divisibleBy5AndGreaterThan25);
```

Obviously, this can also be combined with other conditions.
If conditions are equally faulty, the first of them contributes its message.
```js
/*
* TypeCheckError:
*   Expected positive number that is divisible by 5 and is greater than 25,
*   got a negative number or 0
*/
RuntimeTypeCheck.assertAndThrow(-6, [ Cond.positive, ...divisibleBy5AndGreaterThan25 ]);

/*
* TypeCheckError:
*   Expected positive number that is divisible by 5 and is greater than 25,
*   got a number not divisible by 5
*/
RuntimeTypeCheck.assertAndThrow(-6, [ divisibleBy5, ...divisibleBy5AndGreaterThan25 ]);
```



## Docs
See the generated [docs](https://docs.malus.zone/runtime-type-check/) for a more
in-depth overview of the library.
- [`Cond`](https://docs.malus.zone/runtime-type-check/#Cond)
- [`RuntimeTypeCheck`](https://docs.malus.zone/runtime-type-check/#RuntimeTypeCheck)


## Additional conditions
Here are some useful conditions not provided by the base library that can just
be copy pasted into your own code if you need them!
This is because RuntimeTypeCheck is to be kept as light weight as possible.

The `( ... satisfies Condition) as Condition` construct is used to cast the
object into a condition while not forfeiting type checking.

```ts
/**
 * Assert a value to be not negative (0 or more).
 * Implies {@link number}.
 */
function nonnegative = ({
  conditions: [this.number],
  assert: val => val >= 0,
  shouldBe: { before: 'non-negative' },
  is: 'a negative number'
} satisfies Condition) as Condition;
```
```ts
/**
 * Generate a condition that asserts a value to be inside
 * the given interval (inclusive). Implies {@link number}.
 *
 * @param min Lower interval boundary (inclusive)
 * @param max Upper interval boundary (inclusive)
 */
function range(min: number, max: number): Condition {
  return ({
    conditions: [this.number],
    assert: val => val >= min && val <= max,
    shouldBe: { after: `of the interval [${min}, ${max}]` },
    is: 'a number outside of the required range'
  } satisfies Condition) as Condition;
}
```


## Dev fact
This project incubated within [Slider89](https://github.com/Maluscat/Slider89), with
[this](https://github.com/Maluscat/Slider89/blob/62529f5d2bc83ba311876b86f592f6a5f988ad57/src/core/type-check/RuntimeTypeCheck.ts)
being the last public point of reference. As the rewrite of this version was
finished, I immediately rewrote it again with an even better approach, so the
current version is technically the third major iteration.
