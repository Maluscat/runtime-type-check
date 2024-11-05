# RuntimeTypeCheck
Minimal and modular type checker for the runtime with a heavy focus on producing
readable, concise and smart error messages.



## Installation
Since this library is completely runtime agnostic, it can be used inside any
JavaScript environment, including the web.

### Download
The only required file is `RuntimeTypeCheck.js` inside the [`script`](./script)
folder. If you want type checking, fetch `RuntimeTypeCheck.ts` as well!

### npm
Available on npm under `runtime-type-check`. Use your favorite package manager:
```sh
yarn add runtime-type-check
bun install runtime-type-check
npm install runtime-type-check
```


## Concepts
The core concept of RuntimeTypeCheck is a `Condition`, which is a building
block that contains assertion information. Conditions can recursively extend
other conditions and can be combined as "OR" and "AND" connections.

This allows an overarching assertion to be split up into multiple smaller
conditions, ensuring flexibility. This means that conditions are able to focus
on only one part of an assertion while safely assuming the passed value to already
match various other layers.
For example, a condition `divisible(n)` could extend the condition
`number` and can thus safely assume that any passed value is a number.

If we want to assert a value to be a positive number divisible by 5, we can
AND-combine two assertions `positive` and `divisible(5)`, both of which will
extend the condition `number`.


### Condition
The TS type of a condition looks like this:
```ts
interface Condition {
  assert: (value: any) => boolean;
  conditions?: Descriptor;
  shouldBe: Message;
  is: string | ((data: IsData) => string);
}
```
where
```ts
interface Message {
  before?: string;
  type?: string;
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

#### Explanation
- `assert` defines the assertion function and must return a boolean.
- `conditions` defines conditions that this condition relies on.
  This field is a `Descriptor`, so an "OR" list of "AND" conditions.
- `shouldBe` defines the description of the desired type. From this, a
  sentence is created of the structure `"[...before] [type] [...after]"`
  (e.g. "Should be a positive number of length 5").
- `is` defines what the value is when the condition does **not** assert
  (e.g. "a floating point number" when asserting for an integer).

See below for a more detailed overview with examples.


## Usage
The only non-typing-related exports are `RuntimeTypeCheck` (main library)
and `Cond` (predefined conditions):
```js
import { RuntimeTypeCheck, Cond } from 'runtime-type-check';
```
See the [docs](https://docs.malus.zone/runtime-type-check/) for an overview
of all additional typing related exports for use in TypeScript.

`RuntimeTypeCheck` is an entirely static class. For most use cases, there are
only two relevant methods: `assert` (returns boolean) and `assertAndThrow`
(throws an explanatory error message).

Every method accepts its conditions as a rest parameter, where every parameter
is a descriptor, *any* of which may assert. One descriptor can either be a single
condition or an AND list of conditions. This also applies to the `conditions`
parameter of a `Condition`.

`assertAndThrow` throws an error message that automatically catches the most
relevant condition in the context of the given value. So, when asserting, say,
either a string or a positive integer against the value `-3`, the method will
explain that the given *number* may not be negative.

`Cond` pre-defines commonly used conditions. See an overview in the
[docs](https://docs.malus.zone/runtime-type-check/#Cond).



## Examples
### Using provided `Cond`
Let's assert a value to be either a positive integer or a string. For this,
the conditions provided by the [`Cond`](https://docs.malus.zone/runtime-type-check/#Cond)
class can be used.
```js
import { RuntimeTypeCheck, Cond } from 'runtime-type-check';

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
See the [docs](https://docs.malus.zone/runtime-type-check/) for a complete
overview of the library!
- [`Cond`](https://docs.malus.zone/runtime-type-check/#Cond)
- [`RuntimeTypeCheck`](https://docs.malus.zone/runtime-type-check/#RuntimeTypeCheck)



## Dev fact
This project incubated within [Slider89](https://github.com/Maluscat/Slider89), with
[this](https://github.com/Maluscat/Slider89/blob/30cb8f0606bf6ff27b5c4ec60612865a29553d54/src/core/type-check/RuntimeTypeCheck.ts)
being the last public point of reference. As the rewrite of this version was
finished, I immediately rewrote it again with an even better approach, so the
current version is technically the third major iteration.
