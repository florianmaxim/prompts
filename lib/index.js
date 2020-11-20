'use strict';

const prompts = require('./prompts');

const passOn = ['suggest', 'format', 'onState', 'validate', 'onRender', 'type'];
const noop = () => {};

/**
 * Prompt for a series of questions
 * @param {Array|Object} questions Single question object or Array of question objects
 * @param {Function} [onSubmit] Callback function called on prompt submit
 * @param {Function} [onCancel] Callback function called on cancel/abort
 * @returns {Object} Object with values from user input
 */
async function prompt(questions=[], { onSubmit=noop, onCancel=noop }={}) {
  const answers = {};
  const override = prompt._override || {};
  let answer, quit, name, type, lastPrompt;

  questions = [].concat(questions);

  const getFormattedAnswer = async (question, answer, skipValidation = false) => {
    if (!skipValidation && question.validate && question.validate(answer) !== true) {
      return;
    }
    return question.format ? await question.format(answer, answers) : answer
  };

  for (let index = 0; index < questions.length; index++) {
  
   /*  console.log('')
    console.log('index', index),
    console.log('') */

    let question = questions[index];

    ({ name, type } = question);

    // evaluate type first and skip if type is a falsy value
    if (typeof type === 'function') {
      type = await type(answer, { ...answers }, question)
      question['type'] = type
    }
    if (!type) continue;

    // if property is a function, invoke it unless it's a special function
    for (let key in question) {
      if (passOn.includes(key)) continue;
      let value = question[key];
      question[key] = typeof value === 'function' ? await value(answer, { ...answers }, lastPrompt) : value;
    }

    lastPrompt = question;

    if (typeof question.message !== 'string') {
      throw new Error('prompt message is required');
    }

    // update vars in case they changed
    ({ name, type } = question);

    if (prompts[type] === void 0) {
      throw new Error(`prompt type (${type}) is not defined`);
    }

    if (override[question.name] !== undefined) {
      answer = await getFormattedAnswer(question, override[question.name]);
      if (answer !== undefined) {
        answers[name] = answer;
        continue;
      }
    }

    try {
      // Get the injected answer if there is one or prompt the user
      answer = prompt._injected ? getInjectedAnswer(prompt._injected, question.initial) : await prompts[type](question)

     /*  console.log('')
      console.log('pointer', pointer),
      console.log('') */
      
      answers[name] = answer = await getFormattedAnswer(question, answer, true);
      // quit = await onSubmit(question, answer, answers);
    } catch (err) {
      // console.log(`err: ${err}`)
      switch (err) {
        case "prev":
          quit = false
          await onCancel(question, answers)
          index -= 2
          break;
        case "next":
          quit = false
          index += 3
          break;
        default:
          // quit = !(await onCancel(question, answers));
          //index += 2
          break;
      }
    }

    // console.log(`answersHere, quit: ${quit}`, answers)
    if (quit) return answers;
  }

  // console.log('answers', answers)
  return answers;
}

function getInjectedAnswer(injected, deafultValue) {
  const answer = injected.shift();
    if (answer instanceof Error) {
      throw answer;
    }

    return (answer === undefined) ? deafultValue : answer;
}

function inject(answers) {
  prompt._injected = (prompt._injected || []).concat(answers);
}

function override(answers) {
  prompt._override = Object.assign({}, answers);
}

module.exports = Object.assign(prompt, { prompt, prompts, inject, override });
