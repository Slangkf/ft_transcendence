const toast = $state({ message: null as string | null })

/**
 * Displays a temporary toast notification.
 * The message is automatically cleared after 3 seconds.
 *
 * param message - Text to display in the toast notification.
 */
export function showToast(message: string) {
    toast.message = message
    setTimeout(() => toast.message = null, 3000)
}

// Export the reactive toast state for UI components.
export { toast }