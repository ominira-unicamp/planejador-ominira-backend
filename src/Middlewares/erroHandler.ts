import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";

function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
	if (err.stack) {
		console.error(err.stack)
	}
	console.log(err)
	res.status(500).json({ error: 'Internal Server Error' })
}

export default errorHandler;