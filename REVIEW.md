> Format Used

>Bug: ---- 
>what's the problem: =---- 
>why is it a problem: -------
>Fix: -----

TODO: Mention At first what each issue problems may be and how I based my issues sections

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

# 3. Separation of responsibility between app.js and server.js
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

## 3.Non-unique ID generation `(String(Date.now()))` in `createNewActivity()`
**What**: IDs are derived from the current millisecond timestamp with no uniqueness guarantee.
**Why it's a problem**: two requests processed within the same millisecond, receive identical IDs. This makes Id not a unique key in the file, in turn corrupting any lookup-by-ID logic..
**Fix**: use `crypto.randomUUID()` as a secure, safe function for such logic, which is what is actually used in tasks module from the common utils `Id.json` file

# Security
## 1. Activity Log `addActivity()` has no input validation
### Weakness
- **What**: addActivity writes req.body directly with no checks that required fields(info and action) are present or well-formed.
- **Why it's a problem**: malformed requests either silently corrupt the JSON data store (no error surfaced to the client or logs at all) or produce an unrelated internal exception that gets misclassified as a 500, hiding what is actually a 400-level client error.
- **Fix**: validate the request body (required fields, types) at the controller boundary and throw new HttpError(400, '<specific message>') on failure, matching the pattern used in Tasks.

## 2. task.validator.js exists but is unused        ''''' check '''''''''
- **What**: tasksController.js's createTask/patchTask contain hand-written inline validation instead of calling the existing validateCreateTask/validateUpdateTask from task.validator.js. Critically, the inline version omits the unknown-field rejection (ensureNoUnknownFields) that the unused validator implements.
- **Why it's a problem**: this is a real mass-assignment vulnerability, not just a duplication issue — clients can pass arbitrary extra fields (e.g. a client-supplied id) straight through to tasksService.createTask, something the existing (unused) validator was specifically built to prevent. It also means validation errors bypass the centralized errorHandler response format, losing structured .details and creating two independently-maintained sources of truth for the same validation rules.
-**Fix**: delete the inline validation in the controller and call validateCreateTask/validateUpdateTask instead, exactly as I originally (incorrectly) assumed was already done. This removes duplicated logic, restores the unknown-field/mass-assignment protection, and routes all validation errors through the standard HttpError → errorHandler flow with proper .details.

# Performance
## 1. Activity Log Synchronous I/O operations
### Weakness
- **What**: Activity Log Module is using syncronous I/O operations which will block all the application processing till the operation is finished. 
- **Why it's a problem**: This affects performance greatly as there is alot of processor idle wait
- **Fix**: Use Async Operations (Promise/ async-await) to make use of processor power while the I/O operation is working, then interrupt the processor when the operation is finished. 
*This is actually implemented and used in the project tasks module in jsonStore.js. Therefore, its maintainability and code quality wise to use the common, already implemented functionality as a common util*.

> This is however would cause a problem in not handling errors correctly, as previously the code was dependent on express implicit synchronous error handling
> Therefore, this would propagate as a bug in error handling that need to be fixed