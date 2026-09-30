export type ActionResult<T = void> =
  | { success: true; data: T; error?: never }
  | { success: true; data?: undefined; error?: never }
  | { success: false; error: string; data?: never };

export type MutationResult<T = void> = ActionResult<T>;

export function actionSuccess<T>(data?: T): ActionResult<T> {
  return data !== undefined ? { success: true, data } : { success: true };
}

export function actionError(error: string): ActionResult<never> {
  return { success: false, error };
}
