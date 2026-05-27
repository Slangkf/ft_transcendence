import { writable } from 'svelte/store'

// Stores the number of unread messages per sender.
export const unreadMap = writable<{ [senderId: string]: number }>({})

// Initializes the unread map with data fetched from the server on each socket connection (first load or page refresh).
export function initUnread(entries: {senderId: number, count: number}[]) {
    unreadMap.set(
		Object.fromEntries(entries.map(e => [String(e.senderId), e.count]))
    )
}

// Increments the unread count for a given sender.
export function incrementUnread(senderId : string) {
	unreadMap.update(map => ({
		...map,
		[senderId]: (map[senderId] ?? 0) + 1 // If the sender has no unread count yet, start from 0, then add 1.
	}))
}

// Resets the unread count for a given sender (when the user opens the conversation).
export function resetUnread(senderId : string) {
	unreadMap.update(map => ({
		...map,
		[senderId]: 0
	}))
}
