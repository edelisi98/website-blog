export class RequestBudgetError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestBudgetError";
  }
}

export const deadlineAfter = (milliseconds) => Date.now() + milliseconds;

export const remainingBudget = (deadline) =>
  Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : Infinity;

export async function runWithinBudget(
  operation,
  {
    deadline = Infinity,
    timeoutMs = Infinity,
    label = "Operation",
  } = {}
) {
  const budget = Math.min(remainingBudget(deadline), timeoutMs);
  if (budget <= 0) {
    throw new RequestBudgetError(`${label} exceeded its time budget.`);
  }

  const controller = new AbortController();
  let timeoutId;
  const timeoutPromise = Number.isFinite(budget)
    ? new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new RequestBudgetError(`${label} exceeded its time budget.`));
        }, budget);
      })
    : null;

  try {
    const operationPromise = Promise.resolve().then(() =>
      operation(controller.signal)
    );
    return timeoutPromise
      ? await Promise.race([operationPromise, timeoutPromise])
      : await operationPromise;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function waitWithinBudget(
  milliseconds,
  deadline,
  label = "Retry delay"
) {
  if (milliseconds >= remainingBudget(deadline)) {
    throw new RequestBudgetError(`${label} exceeded its time budget.`);
  }
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
