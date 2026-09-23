# Code Review — VeeLion Task Management Backend

## Methodology

This review is organized into four parts: **Positive Observations**, covering existing patterns in the codebase that are already well designed and worth preserving, and **Issues**, categorized as required into Bugs, Performance, Maintainability, Security, and Code Quality, **Best Practices** applied and **reports module logic**

For each issue, I followed a consistent format:

> - **What**: what is actually wrong, pointed at the specific code.
> - **Why**: the issue pointed consequence
> - **Fix**: a way to improve the issue in as simple as possible yet generally correct solution

---

## 1. Positive Observations

These are existing patterns that are has positive affect in the codebase which are worth keeping as-is, and extending to the modules that don't yet use them.

### 1.1. Async Handler Middleware
Used as a middleware wrapping each route to prevent boilerplate try/catch error handling in each controller.

### 1.2. Error Handler Middleware
Used to catch all errors coming from the async wrapper, creating a centralized, consistent JSON response with no duplicated error-handling logic.   
Why this is a strength:
- Distinguishes operational errors (`HttpError` instances, with a real `statusCode`) from unexpected ones (defaults to 500).
- Hides internal error messages on 500s (`'Internal server error'`) instead of leaking stack traces/DB errors to the client.
- Logs 5xx errors server-side via `console.error`.
- Only exposes `error.details` when the error is a known `HttpError` with details to be shown to the client

### 1.3. Mass-Assignment Protection via Field Allowlisting
`task.validator.js`'s `ensureNoUnknownFields` rejects any field not in `ALLOWED_FIELDS = ['title', 'completed']`
This is a security-conscious pattern to prevent the client from injecting or overwriting fields that should only ever be set by the server at mass assignment (like spread operator in `update task()`).

---

## 2. Bugs

### 2.1. Activity Log has no explicit, consistent error handling
- **What:** the Activity Log module currently depends on implicit Express error handling, with no explicit error handling pattern in its controller functions.
- **Why:** this is inconsistent with how the Tasks module handles errors, and more importantly, it becomes a live bug the moment activity logging is converted to async operations for performance (see Performance #1), without an explicit handler in place, there would be no error handling at all in case of function non-completion.
- **Fix:** use `asyncHandler`, which automatically forwards errors to the error handler middleware for consistent behavior across all modules. Which will also operate correctly in case of changing activity log into asynchronous operations

### 2.2. Read-modify-write race condition — no write serialization in `jsonStore.js`
- **What:** `readJsonArray`/`writeJsonArray` provide no locking. Every mutating operation built on them, `tasksService.createTask`, `updateTask`, `deleteTask`, and `activityService.createNewActivity`, reads the full file, mutates its own in-memory copy, and writes the whole file back, with no coordination between concurrent calls.
- **Why:** under concurrent requests, one request's change can be silently and completely lost when a second request's write overwrites the file with a version that predates the first request's change, causing last write wins condition, classic race condition problem
- **Fix:** serialize writes per file like implementing a locking (mutex) technique per each service implementing the read then write process or a centralized lock inside `jsonStore.js`, keyed by file path, to remove the responsibility from each service call.

### 2.3. Non-unique ID generation in `createNewActivity()`
- **What:** IDs are derived from the current millisecond timestamp (`String(Date.now())`) with no uniqueness guarantee.
- **Why:** two requests processed within the same millisecond receive identical IDs, making `id` not a reliably unique key in the file, in turn corrupting any lookup-by-ID logic.
- **Fix:** use `crypto.randomUUID()`, which is already the pattern used in the Tasks module via the shared `utils/id.js` utility.

### 2.4. Inconsistent title validation rules between `task.controller` and `task.service`
- **What:** the controller only validates that `title` is non-empty after trimming:
```js
payload.title = payload.title.trim();
if (!payload.title) {
  return res.status(400).json({ error: { message: 'title cannot be empty' } });
}
```
while the service separately enforces a minimum length of 2 characters:
```js
if (typeof updates.title === 'string' && updates.title.length < 2) {
  throw new HttpError(400, 'Title is too short.');
}
```
- **Why:** These validations don't contradict each other however enforcing different rules with the exact same logic in both places makes the code redundant and if later the code was "cleaned up" by deleting the duplicate validation, the tighter validation could accidentally be removed since it looks the same.
- **Fix**: Enforce ONE validation/ requirement for the field and make it consistent for the whole module 
---

## 3. Performance Issues

### 3.1. Activity Log synchronous I/O operations
- **What:** the Activity Log module uses synchronous I/O operations, which block all application processing until the operation finishes.
- **Why:** this affects performance significantly, since the process sits idle waiting on disk I/O instead of handling other requests.
- **Fix**: Use Async Operations (Promise/ async-await) to make use of processor power while the I/O operation is working, then interrupt the processor when the operation is finished. 
*This is actually implemented and used in the project tasks module in jsonStore.js. Therefore, its maintainability and code quality wise to use the common, already implemented functionality as a common util*.

> **Note:** switching to async I/O introduces a dependency on proper error handling that didn't previously exist, since the current code relies on Express's implicit synchronous error handling. This ties directly into Bug #1 above, the async conversion and the `asyncHandler` fix need to land together, or the conversion re-introduces a gap in error handling.

---

## 4. Maintainability / Code Quality Issues

### 4.1. Inconsistent response envelope between Tasks and Activity Log APIs
- **What:** Tasks endpoints wrap responses as `{ data: ... }`; Activity Log endpoints (`get_activity`, `addActivity`) return the raw object/array directly with no envelope.
- **Why:** this breaks the implicit API contract, any client consuming both modules needs different parsing logic per endpoint instead of one shared response handler. This also surfaces internally: any future module consuming both APIs has to special-case the format per source.
- **Fix:** standardize on one envelope wrap shape across all modules, matching the Activity Log endpoints to the same `{ data: ... }` wrapper already used by Tasks.

### 4.2. Activity log not wrapped with async handler for consistent error responses
- **What:** error handling in activity log depends express module catching thrown error without using a specific error handling technique.
- **Why:** currently low-risk since Express catches synchronous throws by default, but it's inconsistent with the rest of the codebase and becomes a live bug the moment these handlers are converted to async (needed per Performance #1) without someone remembering to add the wrapper at the same time.
- **Fix:** wrap both handlers in `asyncHandler` now, proactively, so the conversion to async file I/O later doesn't reintroduce this gap.
  >as stated in the Bug issue #1 fix technique

### 4.3. Duplicated `loadData` logic in `activity.service`
- **What:** `loadDataA` and `loadDataB` are two separate functions with identical logic.
- **Why:** This is called "dirty code" which having duplicated logic that causes confusion and reduce code readability
- **Fix:** merge both into one `loadData` function.

### 4.4. Duplicate Validation Logic in Task Module in both `task.controller` and `task.service`
- **What**: There is duplicate validation logic between tasks module controller and service layer which basically validates the same thing
- **Why it's a problem**: This not only confuses and reduces code quality, It also consumes time in both layers for redundant operations
- **Fix**: Insert the validation logic in either service or controller layer. The point, however is if the validation logic was inserted in the controller layer
    * pros: Fast rejection in case of invalid request
    * cons: The service layer would have to trust any other module to validate and sanitize the data if there was internal cross-communication between the 2 modules
If the validation logic was in service layer, It would be the opposite, so its kind of architecture tradeoff that have to be consistent along the whole codebase design.

### 4.5. Naming conventions
- **What:** several variables/functions throughout the codebase, particularly in the Activity Log module, aren't clearly named.
- **Why:** for good code quality and clean-code practice, a consistent naming convention and clear names are needed for easy maintainability and avoiding confusion
- **Fix:** : Renaming into consistent clear naming convention
  1. Rename `get_activity()` in `activity.controller` to `getActivity`, matching the camelCase convention used.
  2. Rename `aSvc` to `activityService`.
  3. Rename `fp` in `activity.service` to `ACTIVITY_FILEPATH`, matching the descriptive, `SCREAMING_SNAKE_CASE` convention used for constants.
  4. Rename `c` in `activity.router` to `activityController`.

---

## 5. Security Issues

### 5.1. Activity Log `addActivity()` has no input validation
- **What:** `addActivity` writes `req.body` directly with no checks that required fields (`info` and `action`) are present or well-formed.
- **Why:** malformed requests either silently corrupt the JSON data store (no error surfaced to the client or logs at all) or produce an unrelated internal exception that gets misclassified as a `500`, hiding what is actually a `400`-level client error.
- **Fix:** validate the request body (required fields, types) at the controller boundary and `throw new HttpError(400, '<specific message>')` on failure, matching the pattern used in the Tasks module.

### 5.2. `task.validator.js` exists but is unused
- **What:** `tasksController.js`'s `createTask`/`patchTask` contain hand-written inline validation instead of calling the existing `validateCreateTask()`/`validateUpdateTask()` from `task.validator.js`.
- **Why:** this is not just a duplication-of-logic issue, the inline validation omits the unknown-field rejection implemented i the validator to protect against mass assignemnt. It also means validation errors bypass the centralized `errorHandler` response, losing the structured middleware format.
- **Fix:** delete the inline validation in the controller and call `validateCreateTask()`/`validateUpdateTask()`.

---

## 6. Other Best Practices Applied in This Codebase

1. Each module split into layers (routes → controllers → services) for separation of concerns.

2. Preferring a single validation method (general moduleValidator) that handles all validation/sanitization rules together, instead of manually listing individual checks in multiple places. (or use a validation library like zod)

3. Separation of Responsibility Between `app.js` and `server.js`, which could have been combined into one, as seen in many projects, is a clean, normalized way of handling different concerns:   
    - `app.js`: defines *what* the application does, middleware, routes, error handling. It builds and exports the configured Express app object but never starts listening on a port.
    - `server.js`: defines *how* the application runs, it takes the app `app.js` built and actually starts it listening on a network port.   

    >This improves maintainability and is particularly useful for testability: tools like `supertest` can use the app directly without binding to a network port.

## 7. Reports Module Service Layer Logic
1. Recent Activity time window is assumed within a day, hardcoded into the codebase
    >Can be changed into a timeline query field coming from the request.
   
2. The Task summary response desired in the readme.md file included tasks status of (done, todo, inprogress).  
However the task data model only has a boolean `completed` field, therefore it is mapped to
    - completed === false -> todo
    - completed === true  -> done
    - in-progress is always 0 since it cannot be derived from the data, otherwise another logic/schema would have to be applied
    (like changing the completed into an enum status)

3. Building Task Summary included a `promise.all` to fetch both activities and tasks independtly and concurrently for optimized performance.
