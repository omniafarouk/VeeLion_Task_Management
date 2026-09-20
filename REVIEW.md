Format Used

Bug: ---- 
what's the problem: =---- 
why is it a problem: -------
How to solve/improve: -----


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


## 3. Inconsistent response envelope between Tasks and Activity Log APIs
### Weakness
- **What:** Tasks endpoints wrap responses as `{ data: ... };` Activity Log endpoints `(get_activity, addActivity)` return the raw object/array directly with no envelope.
- **Why it's a problem:** breaks the implicit API contract , any client consuming both modules needs different parsing logic per endpoint instead of one shared response handler. This also surfaces internally: any future module consuming both APIs has to special-case the format per source.
- **Fix:** standardize on one envelope shape across all modules for consistency and hassle-free design. Therefore matching activity log endpoints with the same json wrap response: `{ data: ... };`

## 4. Activity log not wrapped with async handler for consistent error responses (Activity Log doesn't use asyncHandler, unlike Tasks)
### Weakness
- **What**: handlers are plain synchronous functions registered without the wrapper used everywhere in tasksRouter.
- **Why it's a problem**: currently low-risk since Express catches synchronous throws by default, but it's inconsistent with the rest of the codebase and becomes a live bug the moment these handlers are converted to async (needed anyway, per the sync-I/O finding) without someone remembering to add the wrapper at the same time.
- **Fix**: wrap both handlers in asyncHandler now, proactively, so the conversion to async file I/O later doesn't reintroduce this gap.


# Bugs
## 1. Activity Log has no input validation
### Weakness
- **What**: addActivity writes req.body directly with no checks that required fields are present or well-formed.
- **Why it's a problem**: malformed requests either silently corrupt the JSON data store (no error surfaced to the client or logs at all) or produce an unrelated internal exception that gets misclassified as a 500, hiding what is actually a 400-level client error.
- **Fix**: validate the request body (required fields, types) at the controller boundary and throw new HttpError(400, '<specific message>') on failure, matching the pattern used in Tasks.

## 2. Activity Log having no consistent error handling with tasks Module
- **What**: Activity Log Module is currenly depending on implicit Express error handling with no explicit error handlers in the controller function
- **Why it's a problem**: This is a maintainability problem as a basic case as it's not explicitly mentioning how to handle error. Also, this is a problem with consistency between the different modules on how it handles its errors.
Finally, This would be a huge problem/bug in case of turning activity logging into async operations for performance optimization, as there would be no error handling at all in case of function non-completion
- **Fix**: Use Async Handler which automatically handle errors to the error handler middleware for consistent code. Which will also operate correctly in case of changing activity logginf into asynchronous operations



# Performance
## 1. Activity Log Synchronous I/O operations
### Weakness
- **What**: Activity Log Module is using syncronous I/O operations which will block all the application processing till the operation is finished. 
- **Why it's a problem**: This affects performance greatly as there is alot of processor idle wait
- **Fix**: Use Async Operations (Promise/ async-await) to make use of processor power while the I/O operation is working, then interrupt the processor when the operation is finished.

> This is however would cause a problem in not handling errors correctly, as previously the code was dependent on express implicit synchronous error handling
> Therefore, this would propagate as a bug in error handling that need to be fixed