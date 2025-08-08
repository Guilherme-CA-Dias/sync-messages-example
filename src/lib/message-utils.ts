/**
 * Utility functions for message handling
 */

/**
 * Gets the display name for a message sender, with fallback logic
 * @param message - The message object containing sender and ownerName
 * @returns The display name to show for the sender
 */
export function getMessageSenderName(message: {
	sender: string;
	ownerName?: string;
}): string {
	// Prefer ownerName if available, otherwise fall back to sender
	return message.ownerName || message.sender;
}

/**
 * Determines if a message should show the sender name based on grouping logic
 * Only shows names for incoming messages, not outgoing ones
 * @param messages - Array of all messages
 * @param currentIndex - Index of the current message
 * @returns True if the sender name should be displayed
 */
export function shouldShowSenderName(
	messages: Array<{
		sender: string;
		direction: "incoming" | "outgoing";
	}>,
	currentIndex: number
): boolean {
	const currentMessage = messages[currentIndex];

	// Only show names for incoming messages
	if (currentMessage.direction !== "incoming") {
		return false;
	}

	if (currentIndex === 0) return true; // Always show for the first message

	const previousMessage = messages[currentIndex - 1];

	if (!previousMessage) return true; // Should not happen if index > 0

	// Show name if previous message was from different sender or was outgoing
	return (
		previousMessage.sender !== currentMessage.sender ||
		previousMessage.direction === "outgoing"
	);
}
