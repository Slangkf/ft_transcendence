import { writable } from 'svelte/store'

// Store holding the number of unread messages per sender.
export const unreadMap = writable<{ [senderId: string]: number }>({})

// Increment the unread count for a given sender.
export function incrementUnread(senderId : string) {
	unreadMap.update(map => ({
		...map,
		[senderId]: (map[senderId] ?? 0) + 1 // If the sender has no unread count yet, start from 0, then add 1.
	}))
}

// Reset the unread count for a given sender (when the user opens the conversation).
export function resetUnread(senderId : string) {
	unreadMap.update(map => ({
		...map,
		[senderId]: 0
	}))
}
