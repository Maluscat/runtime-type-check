import { RuntimeTypeCheck } from '../script/RuntimeTypeCheck.js';
window.RuntimeTypeCheck = RuntimeTypeCheck;
window.Cond = RuntimeTypeCheck.Cond;

mocha.setup({
  ui: 'bdd',
  timeout: 100,
  // allowUncaught: true,
});
