import { RuntimeTypeCheck, Cond } from '../script/RuntimeTypeCheck.js';
window.RuntimeTypeCheck = RuntimeTypeCheck;
window.Cond = Cond;

mocha.setup({
  ui: 'bdd',
  timeout: 100,
  // allowUncaught: true,
});
