// Reactive object holding the current toast message, null means no toast is displayed
const toast = $state({ message: null as string | null })

// Display a toast notification for 3 seconds
export function showToast(message: string) {
    toast.message = message
    setTimeout(() => toast.message = null, 3000)
}

export { toast }