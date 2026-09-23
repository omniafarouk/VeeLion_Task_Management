# Maintainability or Code quality

## 1. Async Handler Middleware 
### Strength
used as a middleware wrapping each route to prevent boilerplate try/catch error handling method for each controller

----------------------------- 

## 2. Error Handler Middleware
### Strength
It is used to catch all errors coming from the async wrapper , wrapping thre routers, to create a centralized, consistent JSON response with no duplicated error-handling logic

why its a strength: 
* Checks res.headersSent first — correct Express convention, prevents "Cannot set headers after they are sent" crashes.
* Distinguishes operational errors (HttpError instances, with a real statusCode) from unexpected ones (defaults to 500).
* Hides internal error messages on 500s ('Internal server error') instead of leaking stack traces/DB errors to the client — this is a real security practice, not just style.
* Logs 5xx errors server-side via console.error.
* Only exposes error.details when the error is a known HttpError with details — avoids leaking arbitrary object internals.

## 3. Separation of responsibility between app.js and server.js
- **what** : The Separation of Responsibilty between both `app.js` and `server.js` files, that could have been in one file as many projects I have seen before. is actually a clean normalized of handling different concerns
- **why**: This improves maintainability and code quality:
    * `app.js`: defines what the application does: middleware, routes, error handling. It builds and exports the configured Express app object, but never starts listening on a port.
    * `server.js`: defines how the application runs: it takes the app app.js built, and actually starts it listening on a network port.
 > which could actually be better used in testability for tools like `supertest` to use the app directly without binding to the network port

## 4. Inconsistent response envelope between Tasks and Activity Log APIs
### Weakness
- **What:** Tasks endpoints wrap responses as `{ data: ... };` Activity Log endpoints `(get_activity, addActivity)` return the raw object/array directly with no envelope.
- **Why it's a problem:** breaks the implicit API contract , any client consuming both modules needs different parsing logic per endpoint instead of one shared response handler. This also surfaces internally: any future module consuming both APIs has to special-case the format per source.
- **Fix:** standardize on one envelope shape across all modules for consistency and hassle-free design. Therefore matching activity log endpoints with the same json wrap response: `{ data: ... };`

## 5. Activity log not wrapped with async handler for consistent error responses (Activity Log doesn't use asyncHandler, unlike Tasks)
### Weakness
- **What**: handlers are plain synchronous functions registered without the wrapper used everywhere in tasksRouter.
- **Why it's a problem**: currently low-risk since Express catches synchronous throws by default, but it's inconsistent with the rest of the codebase and becomes a live bug the moment these handlers are converted to async (needed anyway, per the sync-I/O finding) without someone remembering to add the wrapper at the same time.
- **Fix**: wrap both handlers in asyncHandler now, proactively, so the conversion to async file I/O later doesn't reintroduce this gap.

## 6. loadData in activity.service duplicated logic with no significant difference between the 2 functions 
- **What**: `loadDataA` and `loadDataB` are 2 separate functions with the exact same logic.
- **Why it's a problem**: This is called "dirty code" which having duplicated logic that causes confusion and affect code readability
- **Fix**: merge both into one function `loadData`

## 7. Duplicate Validation Logic in Task Module in both `task.controller` and `task.service`
- **What**: There is duplicate validation logic between tasks module controller and service layer which basically validates the same thing
- **Why it's a problem**: This not only confuses and reduces code quality, It also consumes time in both layers for redundant operations
- **Fix**: Insert the validation logic in either service or controller layer. The point, however is if the validation logic was inserted in the controller layer
    * pros: Fast rejection in case of invalid request
    * cons: The service layer would have to trust any other module to validate and sanitize the data if there was internal cross-communication between the 2 modules
If the validation logic was in service layer, It would be the opposite, so its kind of architecture tradeoff that have to be consistent along the whole code design.

## Renaming into consistent clear naming convention
- **What**: There are variables/functions that aren't well named throughout the code (activity module especially)
- **Why**: For good code quality "clean code", a naming convention and clear names must be used to for easy maintainability and avoiding confusion
- **Fix**: 
    1. Renaming `get_activity()` in activity.controller to `getActivity` for consistent camelCase naming convention for all functions
    2. Renaming `aSvc` into clear name `activityService`
    3. Renaming `fp` in activity.service into `ACTIVITY_FILEPATH`, descriptive and SCREAMING_SNAKE_CASE convention for constant variable indication
    4. `c` in activity.router into `activityRouter`


# Bugs

## 1. Activity Log having no consistent error handling with tasks Module
- **What**: Activity Log Module is currenly depending on implicit Express error handling with no explicit error handlers in the controller function
- **Why it's a problem**: This is a maintainability problem as a basic case as it's not explicitly mentioning how to handle error. Also, this is a problem with consistency between the different modules on how it handles its errors.
Finally, This would be a huge problem/bug in case of turning activity logging into async operations for performance optimization, as there would be no error handling at all in case of function non-completion
- **Fix**: Use Async Handler which automatically handle errors to the error handler middleware for consistent code. Which will also operate correctly in case of changing activity logginf into asynchronous operations

## 2. Read-modify-write race condition on activity.json in `createNewActivity()` function
- **What** : concurrent requests each read the full file, mutate their own in-memory copy, and write the whole file back, causing only the last write to be saved.
- **Why it's a problem**: under concurrent requests, one request's addition can be silently and completely lost when a second request's write overwrites the file with a version that predates the first request's change, causing last write wins condition, classic race condition problem
- **Fix**: create a mutex from the start to the end to create an atomic block for concurrent functions to be safely isolated
or move to a database that handles such concurrent writes safely.

## 2. Read-modify-write race condition — no write serialization in `jsonStore.js`    <-------------- check
- **What**: `readJsonArray`/`writeJsonArray` provide no locking. Every mutating operation built on them — `tasksService.createTask`, `updateTask`, `deleteTask`, and `activityService.createNewActivity` — reads the full file, mutates its own in-memory copy, and writes the whole file back, with no coordination between concurrent calls.
- **Why it's a problem**: under concurrent requests (even different tasks being updated at once, or a task update racing an activity write), one request's change can be silently and completely lost when a second request's write overwrites the file with a version that predates the first request's change — classic last-write-wins race condition. This affects both modules identically, since both are built on the same underlying utility, so it's a single root cause rather than an isolated activity-log bug.
- **Fix**: serialize writes per file — e.g. an in-process async mutex/queue keyed by file path, added once inside `jsonStore.js` so every caller is protected automatically rather than each service reimplementing its own locking. Note this only guards against races within a single Node process; if the app ever ran multiple instances, real file locking (e.g. `proper-lockfile`) or a datastore would be needed instead.

-----
Fix: wrap each read-modify-write sequence in a per-file mutex (async-mutex or a hand-rolled promise chain) at the service layer. Simpler to add incrementally, but the lock scope must be kept in sync with file ownership by convention — a centralized lock inside jsonStore.js, keyed by file path, would remove that responsibility from each service author.
-----

## 3. Non-unique ID generation in `createNewActivity()`
- **What**: IDs are derived from the current millisecond timestamp `(String(Date.now()))`  with no uniqueness guarantee.
- **Why it's a problem**: two requests processed within the same millisecond, receive identical IDs. This makes Id not a unique key in the file, in turn corrupting any lookup-by-ID logic..
- **Fix**: use `crypto.randomUUID()` as a secure, safe function for such logic, which is what is actually used in tasks module from the common utils `Id.json` file

## 4. Different Validation logic between task.service and task.controller 
- **What**: Validation of title in task.controller is validating only if title isn't empty 
```jsx
  payload.title = payload.title.trim();
  if (!payload.title) {
    return res.status(400).json({ error: { message: 'title cannot be empty' } });
    }
```
while validation in task.service validates title is more than 2 characters.
```jsx
  if (typeof updates.title === 'string' && updates.title.length < 2) {
    throw new HttpError(400, 'Title is too short.');
  }
```
- **Why its a problem**: These validations don't contradict each other however enforcing different rules with the exact same logic in both places makes the code redundant and if later the code was "cleaned up" by deleting the duplicate validation, the tighter validation could accidentally be removed since it looks the same.
- **Fix**: Enforce ONE validation/ requirement for the field and make it consistent for the whole module 

# Security
## 1. Activity Log `addActivity()` has no input validation
- **What**: addActivity writes req.body directly with no checks that required fields(info and action) are present or well-formed.
- **Why it's a problem**: malformed requests either silently corrupt the JSON data store (no error surfaced to the client or logs at all) or produce an unrelated internal exception that gets misclassified as a 500, hiding what is actually a 400-level client error.
- **Fix**: validate the request body (required fields, types) at the controller boundary and throw new HttpError(400, '<specific message>') on failure, matching the pattern used in Tasks Module.

## 2. task.validator.js exists but is unused
- **What**: tasksController.js's createTask/patchTask contain hand-written inline validation instead of calling the existing `validateCreateTask()/validateUpdateTask()` from `task.validator.js.`.
- **Why it's a problem**: This is not only a duplication logic issue. It also means validation errors bypass the centralized errorHandler response, losing the structured middleware format.
-**Fix**: delete the inline validation in the controller and call `validateCreateTask()/validateUpdateTask()`.

# Performance
## 1. Activity Log Synchronous I/O operations
### Weakness
- **What**: Activity Log Module is using syncronous I/O operations which will block all the application processing till the operation is finished. 
- **Why it's a problem**: This affects performance greatly as there is alot of processor idle wait
- **Fix**: Use Async Operations (Promise/ async-await) to make use of processor power while the I/O operation is working, then interrupt the processor when the operation is finished. 
*This is actually implemented and used in the project tasks module in jsonStore.js. Therefore, its maintainability and code quality wise to use the common, already implemented functionality as a common util*.

> This is however would cause a problem in not handling errors correctly, as previously the code was dependent on express implicit synchronous error handling
> Therefore, this would propagate as a bug in error handling that need to be fixed


# Best Practice Code implementations
1. each module split into 3 layers for separation of concern
2. using validation method that handles all kind of validation and sanitization method instead of manual listing one by one
3. Validate in service as well as controller to sanitize data coming from other service instead of from a controller (HTTP request)


## Reports Module Service Layer Logic
1. Recent Activity time window is assumed within a day, hardcoded into the codebase
    >Can be changed into a timeline query field coming from the request.
   
2. The Task summary response desired in the readme.md file included tasks status of (done, todo, inprogress).  
However the task data model only has a boolean `completed` field, therefore it is mapped to
    - completed === false -> todo
    - completed === true  -> done
    - in-progress is always 0 since it cannot be derived from the data, otherwise another logic/schema would have to be applied
    (like changing the completed into an enum status)

3. Building Task Summary included a `promise.all` to fetch both activities and tasks independtly and concurrently for optimized performance.
