// All Jev question wording lives here. Each question asks for one judgment; policy.mjs decides.

const noul = (instructions, whenTrue, whenFalse) => ({
  type: "noul",
  instructions,
  criteria: { true: whenTrue, false: whenFalse },
});

export const QUESTIONS = {
  approval_only: noul(
    "Does `request` only approve or continue the work described in `previous_assistant_message`?",
    "The user says something like 'yes', 'go ahead', or 'continue' and adds no new work",
    "The user asks for new or different work",
  ),
  mechanical_task: noul(
    "Can `request` be completed by following obvious steps?",
    "The work is something like a rename, a reformat, adding a comment, or running one named command",
    "Someone has to decide how to implement or fix something",
  ),
  factual_question: noul(
    "Does `request` ask a simple factual question?",
    "A few sentences answer it, as in 'what does this flag do?'",
    "It asks for changes to code, or for analysis of trade-offs",
  ),
  multi_module: noul(
    "Does `request` require changing several modules of a codebase?",
    "The work reaches across several separate parts of the code",
    "The work stays in one file or one small area",
  ),
  unknown_cause: noul(
    "Does `request` ask to fix a problem whose cause has not been found yet?",
    "Something misbehaves and the user does not say why",
    "The user already states the cause, or nothing is broken",
  ),
  design_decision: noul(
    "Does `request` ask for an architecture or design to be chosen?",
    "The work involves choosing how the parts of a system should fit together",
    "The design is already settled",
  ),
  auth_or_security: noul(
    "Does `request` change authentication, authorization, or security-sensitive code?",
    "The work touches logins, permissions, secrets, or input an attacker controls",
    "The work has no effect on what users are allowed to do or see",
  ),
  concurrency: noul(
    "Does `request` involve concurrent or asynchronous code where timing affects correctness?",
    "The work involves races, locks, or ordering between parallel operations",
    "Operations run one after another and their order is obvious",
  ),
  data_migration: noul(
    "Does `request` change a database schema or migrate stored data?",
    "The work alters how existing stored data is shaped or moved",
    "Stored data keeps its current shape",
  ),
  long_running: noul(
    "Does `request` ask for work across a whole repository or lasting several hours?",
    "The work is something like a repo-wide migration or a multi-hour autonomous task",
    "A focused session could finish the work",
  ),
};

export const QUESTION_NAMES = Object.keys(QUESTIONS);
