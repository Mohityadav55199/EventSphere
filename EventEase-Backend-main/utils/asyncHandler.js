const asyncHandler = (requestHandler)=>{
    return async (req, res, next) => {
        try {
            // resolve the promise returned by the request handler
            await Promise.resolve(requestHandler(req,res,next))
        } catch (err) {
            // if an error occurs, pass it to the next function
            next(err)
        }
    }
}

export {asyncHandler}