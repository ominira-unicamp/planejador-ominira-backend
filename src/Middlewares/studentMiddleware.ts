import { NextFunction, Request, Response } from "express";

export default async function studentMiddleware(req : Request, res : Response, next: NextFunction) {
	if (isNaN(Number(req.params.sid))) {
		res.status(400).json({ error: "Student ID must be a number" });
		return;
	}
	const student = await req.prisma.student.findUnique({ where: { id: Number(req.params.sid) } })
	if (!student) {
		res.status(404).json({ error: "Student not found" });
		return;
	}
	next();
}