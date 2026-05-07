
export const Apiresponse = {
    success: (data: any, message = "ok") => ({
        success: true,
        message,
        data,
        error: null,
    }),

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