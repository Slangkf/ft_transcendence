
export const Apiresponse = {
    /* Builds a standard success envelope: { success: true, message, data, error: null }. */
    success: (data: any, message = "ok") => ({
        success: true,
        message,
        data,
        error: null,
    }),

    /* Builds a standard error envelope: { success: false, data: null, error: { code, message } }. */
    error: (code: string, message: string) => ({
        success: false,
        message,
        data: null,
        error: {
            code,
            message,
        },
    })
}