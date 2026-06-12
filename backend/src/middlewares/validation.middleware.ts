import { NextFunction, Request, Response } from 'express'
import { ZodTypeAny } from 'zod'

export const validateBody = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parseResult = schema.safeParse(req.body)

    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      return res.status(400).json({ error: 'Validation échouée.', details: errors })
    }

    ;(req as any).body = parseResult.data
    return next()
  }
}
