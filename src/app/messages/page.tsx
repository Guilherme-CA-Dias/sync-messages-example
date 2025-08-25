"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useChats } from "@/hooks/use-chats";
import { useMessages } from "@/hooks/use-messages";
import { useSyncMessages } from "@/hooks/use-sync-messages";
import { useIntegrationContext } from "@/contexts/integration-context";
import { useIntegrations } from "@integration-app/react";
import { Sidebar } from "@/components/sidebar";
import { ChatListSection } from "@/components/chat-list-section";
import { ChatscopeChat } from "@/components/chatscope-chat";
import { SyncChatsDialog } from "@/components/sync-chats-dialog";
import { IntegrationsDialog } from "@/components/integrations-dialog";
import { DeleteChatDialog } from "@/components/delete-chat-dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, Plus, X, MessageCircle } from "lucide-react";
import type { Message } from "@/types/message";
import { ensureAuth } from "@/lib/auth";
import { sendMessageToThirdParty, validateMessage } from "@/lib/message-api";
import { SyncButton } from "@/components/sync-button";

// Define ConnectedApp type to match the sync dialog
interface ConnectedApp {
	key: string;
	name: string;
	logoUri?: string;
	connection?: {
		id: string;
	};
	integration?: {
		key: string;
	};
}

// Define Integration type to match the integration context
interface Integration {
	key: string;
	name: string;
	connection?: {
		id: string;
	};
	integration?: {
		key: string;
	};
}

export default function MessagesPage() {
	// Hooks
	const {
		messages,
		isLoading: messagesLoading,
		mutate: mutateMessages,
	} = useMessages();
	const { chats, isLoading: chatsLoading, mutate: refreshChats } = useChats();
	const { syncMessages, isSyncing, lastSyncTime, status, error } =
		useSyncMessages();
	const { integrations } = useIntegrations();
	const { selectedIntegration, setSelectedIntegration, exportSupportMap } =
		useIntegrationContext();
	const [isIntegrationsDialogOpen, setIsIntegrationsDialogOpen] =
		useState(false);
	const [isDeleteChatDialogOpen, setIsDeleteChatDialogOpen] = useState(false);
	const [chatToDelete, setChatToDelete] = useState<{
		id: string;
		name: string;
	} | null>(null);

	// Get connected integrations
	const connectedIntegrations = integrations.filter(
		(integration) => integration.connection
	);

	// Add a small delay to prevent flash of "no connections" state
	const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

	useEffect(() => {
		// Wait for integrations to load or timeout after 2 seconds
		const timer = setTimeout(() => {
			setHasInitiallyLoaded(true);
		}, 2000);

		// If we get integrations before timeout, mark as loaded immediately
		if (integrations.length > 0) {
			clearTimeout(timer);
			setHasInitiallyLoaded(true);
		}

		return () => clearTimeout(timer);
	}, [integrations.length]);

	// Show loading state if we haven't initially loaded yet
	const shouldShowLoading = !hasInitiallyLoaded;

	// State
	const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
	const [chatSearchQuery, setChatSearchQuery] = useState("");
	const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);

	// Stable callback for search
	const handleSearchChange = useCallback((value: string) => {
		setChatSearchQuery(value);
	}, []);

	// Computed values
	const filteredChats = useMemo(() => {
		let filtered = chats;

		// Filter by selected integration if one is selected
		if (selectedIntegration) {
			filtered = chats.filter(
				(chat) => chat.integrationId === selectedIntegration.connection?.id
			);
		}

		// Then filter by search query
		return filtered.filter(
			(chat) =>
				chat.name.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
				chat.platformName
					?.toLowerCase()
					.includes(chatSearchQuery.toLowerCase()) ||
				chat.lastMessage?.toLowerCase().includes(chatSearchQuery.toLowerCase())
		);
	}, [chats, chatSearchQuery, selectedIntegration]);
	const selectedChat = chats.find((chat) => chat.id === selectedChatId);
	const selectedChatName = selectedChat?.name;
	const selectedChatIntegrationId = selectedChat?.integrationId;
	const selectedChatPlatformName = selectedChat?.platformName;

	// Helper functions
	const createNewMessage = useCallback(
		(content: string): Message => {
			const currentUser = ensureAuth();
			return {
				id: `local-${Date.now()}-${Math.random()}`,
				content,
				sender: currentUser.customerId,
				timestamp: new Date().toISOString(),
				chatId: selectedChatId!,
				integrationId: selectedChatIntegrationId || "local",
				platformName: selectedChatPlatformName || "Local",
				messageType: "user",
				status: "pending",
			};
		},
		[selectedChatId, selectedChatIntegrationId, selectedChatPlatformName]
	);

	const updateMessageStatus = useCallback(
		(
			messages: Message[],
			messageId: string,
			status: "pending" | "sent" | "failed"
		) => {
			return messages.map((msg) =>
				msg.id === messageId ? { ...msg, status } : msg
			);
		},
		[]
	);

	const addMessageToCache = useCallback(
		(newMessage: Message) => {
			const updatedMessages = [...messages, newMessage];
			mutateMessages({ messages: updatedMessages }, false);
			return updatedMessages;
		},
		[messages, mutateMessages]
	);

	const updateCacheWithStatus = useCallback(
		(
			messages: Message[],
			messageId: string,
			status: "pending" | "sent" | "failed"
		) => {
			const updatedMessages = updateMessageStatus(messages, messageId, status);
			mutateMessages({ messages: updatedMessages }, false);
		},
		[updateMessageStatus, mutateMessages]
	);

	// Helper function to get standardized platformId
	const getStandardizedPlatformId = (
		integration: ConnectedApp | Integration
	): string => {
		console.log("🔍 getStandardizedPlatformId input:", integration);

		// Try to get the integration key from various possible locations
		const platformId =
			integration.integration?.key ||
			integration.key ||
			integration.name?.toLowerCase() ||
			"unknown";

		console.log("🔍 getStandardizedPlatformId result:", platformId);
		return platformId;
	};

	// Event handlers
	const handleSync = async () => {
		console.log(
			"🔍 handleSync called with selectedIntegration:",
			selectedIntegration
		);
		console.log(
			"🔍 selectedIntegration?.connection?.id:",
			selectedIntegration?.connection?.id
		);
		console.log("🔍 selectedIntegration?.key:", selectedIntegration?.key);
		console.log(
			"🔍 Current sync status - isSyncing:",
			isSyncing,
			"status:",
			status
		);

		// Always open the sync dialog - it will handle app selection if needed
		console.log("📱 Opening sync dialog");
		setIsSyncDialogOpen(true);
	};

	const handleSyncSelectedChats = async (
		selectedChatIds: string[],
		importNew: boolean,
		selectedApp?: ConnectedApp
	) => {
		console.log("🔍 handleSyncSelectedChats called with:");
		console.log("🔍 selectedChatIds:", selectedChatIds);
		console.log("🔍 importNew:", importNew);
		console.log("🔍 selectedApp:", selectedApp);
		console.log("🔍 selectedIntegration:", selectedIntegration);

		// Use selectedApp from dialog if provided, otherwise fall back to global selectedIntegration
		const integration = selectedApp || selectedIntegration;

		console.log("🔍 Final integration object:", integration);

		if (!integration) {
			console.error("No integration selected for sync");
			return;
		}

		console.log("🔍 Integration object:", integration);
		console.log("🔍 Integration key:", integration.key);
		console.log("🔍 Integration connection:", integration.connection);
		console.log("🔍 Integration integration:", integration.integration);

		// Use the standardized platformId (integration key) for UserPlatform operations
		const platformId = getStandardizedPlatformId(integration);

		// Use the connection ID for sync operations (this is what the sync API expects)
		const connectionId = integration.connection?.id || integration.key;

		console.log("🔍 Using platformId:", platformId);
		console.log("🔍 Using connectionId:", connectionId);

		if (!connectionId) {
			console.error("No integration connection ID found");
			console.error(
				"Integration object:",
				JSON.stringify(integration, null, 2)
			);
			return;
		}

		try {
			console.log("🔍 Syncing selected chats:", selectedChatIds);
			console.log("🔍 Import new messages:", importNew);

			// Use connectionId for sync API (this is what it expects)
			const result = await syncMessages(connectionId, selectedChatIds);

			// Note: importNew setting is managed through the sync dialog UI
			// We don't need to update it here during sync operations
			console.log("🔍 Sync completed - importNew setting managed through UI");

			console.log("✅ Sync completed:", result);

			// Refresh data immediately after sync completion
			console.log("🔄 Refreshing data after sync...");
			await Promise.all([
				refreshChats(), // Refresh chats list
				mutateMessages(), // Refresh messages
			]);
			console.log("✅ Data refresh completed");
		} catch (error) {
			console.error("❌ Sync failed:", error);
		}
	};

	const handleSendMessage = useCallback(
		async (message: string) => {
			if (!selectedChatId) return;

			// Validate message
			const validation = validateMessage(message);
			if (!validation.isValid) {
				console.error("Message validation failed:", validation.error);
				return;
			}

			// Create and add message optimistically
			const newMessage = createNewMessage(message);
			const updatedMessages = addMessageToCache(newMessage);

			console.log("Sending message:", message, "to chat:", selectedChatId);

			// Send to third-party system
			try {
				const response = await sendMessageToThirdParty({
					message,
					chatId: selectedChatId,
					integrationId: selectedChatIntegrationId || "local",
					recipient: selectedChat?.participants?.[0] || selectedChatId,
					chatName: selectedChatName,
					chatType: "direct", // Default to direct, can be enhanced later
					platformName: selectedChatPlatformName,
					messageType: "text",
				});

				if (response.success) {
					// Update status immediately based on response
					updateCacheWithStatus(
						updatedMessages,
						newMessage.id,
						response.status || "sent"
					);
					console.log(
						`Message sent successfully with status: ${response.status}`
					);
				} else {
					updateCacheWithStatus(updatedMessages, newMessage.id, "failed");
					console.error("Failed to send message:", response.error);
				}
			} catch (error) {
				updateCacheWithStatus(updatedMessages, newMessage.id, "failed");
				console.error("Failed to send message to third-party system:", error);
			}
		},
		[
			selectedChatId,
			addMessageToCache,
			createNewMessage,
			selectedChat?.participants,
			selectedChatIntegrationId,
			selectedChatName,
			selectedChatPlatformName,
			updateCacheWithStatus,
		]
	);

	const handleRetryMessage = useCallback(
		async (messageId: string) => {
			if (!selectedChatId) return;

			// Find the message to retry
			const messageToRetry = messages.find((msg) => msg.id === messageId);
			if (!messageToRetry) {
				console.error("Message not found for retry:", messageId);
				return;
			}

			console.log(
				"Retrying message:",
				messageToRetry.content,
				"to chat:",
				selectedChatId
			);

			// Update message status to pending
			updateCacheWithStatus(messages, messageId, "pending");

			// Send to third-party system
			try {
				const response = await sendMessageToThirdParty({
					message: messageToRetry.content,
					chatId: selectedChatId,
					integrationId: selectedChatIntegrationId || "local",
					recipient: selectedChat?.participants?.[0] || selectedChatId,
					chatName: selectedChatName,
					chatType: "direct",
					platformName: selectedChatPlatformName,
					messageType: "text",
					messageId: messageId, // Pass the existing message ID for retry
				});

				if (response.success) {
					// Update status immediately based on response
					updateCacheWithStatus(messages, messageId, response.status || "sent");
					console.log(
						`Message retry successful with status: ${response.status}`
					);
				} else {
					updateCacheWithStatus(messages, messageId, "failed");
					console.error("Failed to retry message:", response.error);
				}
			} catch (error) {
				updateCacheWithStatus(messages, messageId, "failed");
				console.error("Failed to retry message:", error);
			}
		},
		[
			selectedChatId,
			selectedChat?.participants,
			selectedChatIntegrationId,
			selectedChatName,
			selectedChatPlatformName,
			updateCacheWithStatus,
			messages,
		]
	);

	const handleDeleteChat = useCallback((chatId: string, chatName: string) => {
		setChatToDelete({ id: chatId, name: chatName });
		setIsDeleteChatDialogOpen(true);
	}, []);

	const handleDeleteChatSuccess = useCallback(() => {
		// Refresh chats and messages after deletion
		refreshChats();
		mutateMessages();
		// Clear selected chat if it was the deleted one
		if (chatToDelete && selectedChatId === chatToDelete.id) {
			setSelectedChatId(undefined);
		}
		setChatToDelete(null);
	}, [chatToDelete, selectedChatId, refreshChats, mutateMessages]);

	// Filter messages by selected integration
	const filteredMessages = useMemo(() => {
		if (selectedIntegration) {
			return messages.filter(
				(message) =>
					message.integrationId === selectedIntegration.connection?.id
			);
		}
		return messages;
	}, [messages, selectedIntegration]);

	const uniquePlatformsCount = new Set(
		filteredMessages.map((m) => m.platformName).filter(Boolean)
	).size;

	// UI Components
	const HeaderSection = () => (
		<div className="flex justify-between items-center">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					{selectedIntegration
						? `${selectedIntegration.name} Messages`
						: "Messages"}
				</h1>
				<p className="text-muted-foreground">
					{selectedIntegration
						? `View and manage your messages from ${selectedIntegration.name}`
						: "View and manage your messages across all integrations"}
				</p>
				{selectedIntegration && (
					<Button
						onClick={() => setSelectedIntegration(null)}
						variant="ghost"
						size="sm"
						className="mt-2 text-gray-500 hover:text-gray-700"
					>
						<X className="w-4 h-4 mr-1" />
						Clear Filter
					</Button>
				)}
			</div>
			<div className="flex flex-col items-end space-y-2">
				<SyncButton
					onSync={handleSync}
					isSyncing={isSyncing}
					lastSyncTime={lastSyncTime}
					status={status}
					integrationName={selectedIntegration?.name || undefined}
					integrationKey={selectedIntegration?.key}
					isDisabled={
						selectedIntegration?.key
							? exportSupportMap[selectedIntegration.key] === false
							: false
					}
					showMessage={true}
				/>

				{/* Error display */}
				{error && (
					<div className="text-red-600 dark:text-red-400 text-sm">
						Error: {error}
					</div>
				)}
			</div>
		</div>
	);

	const ChatViewSection = () => (
		<div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
			<div className="flex items-center space-x-2 p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<MessageSquare className="h-5 w-5 text-gray-500" />
				<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
					Messages
				</h2>
			</div>
			<div className="flex-1 overflow-hidden">
				<ChatscopeChat
					messages={filteredMessages}
					selectedChatId={selectedChatId}
					isLoading={messagesLoading}
					onSendMessage={handleSendMessage}
					onRetryMessage={handleRetryMessage}
				/>
			</div>
		</div>
	);

	const StatsSection = () => (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
			<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<div className="flex items-center">
					<MessageCircle className="h-8 w-8 text-blue-500" />
					<div className="ml-3">
						<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
							Total Messages
						</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							{filteredMessages.length}
						</p>
					</div>
				</div>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<div className="flex items-center">
					<MessageCircle className="h-8 w-8 text-green-500" />
					<div className="ml-3">
						<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
							Active Chats
						</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							{filteredChats.length}
						</p>
					</div>
				</div>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<div className="flex items-center">
					<MessageCircle className="h-8 w-8 text-purple-500" />
					<div className="ml-3">
						<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
							Platforms
						</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							{uniquePlatformsCount}
						</p>
					</div>
				</div>
			</div>
		</div>
	);

	// Main render
	return (
		<div className="flex h-[calc(100vh-40px)]">
			<Sidebar />
			<div className="flex-1 p-8">
				{shouldShowLoading ? (
					// Loading state
					<div className="flex flex-col items-center justify-center h-full text-center">
						<Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
						<p className="text-lg text-muted-foreground">
							Loading integrations and messages...
						</p>
					</div>
				) : connectedIntegrations.length === 0 ? (
					// No connections state
					<div className="flex flex-col items-center justify-center h-full text-center">
						<div className="max-w-md mx-auto">
							<div className="w-24 h-24 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mx-auto mb-6">
								<Plus className="w-12 h-12 text-blue-600 dark:text-blue-300" />
							</div>
							<h1 className="text-3xl font-bold tracking-tight mb-4">
								Connect Your First Integration
							</h1>
							<p className="text-lg text-muted-foreground mb-8">
								Get started by connecting your messaging platforms to sync and
								manage all your conversations in one place.
							</p>
							<Button
								onClick={() => setIsIntegrationsDialogOpen(true)}
								size="lg"
								className="bg-blue-600 hover:bg-blue-700 text-white"
							>
								<Plus className="mr-2 h-5 w-5" />
								Connect Integration
							</Button>
						</div>
					</div>
				) : (
					// Normal content when integrations exist
					<div className="flex flex-col gap-4">
						<HeaderSection />

						{/* Main Content */}
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
							<ChatListSection
								chats={filteredChats}
								selectedChatId={selectedChatId}
								onChatSelect={setSelectedChatId}
								onChatDelete={handleDeleteChat}
								onSyncChats={handleSync}
								isSyncing={isSyncing}
								isLoading={chatsLoading}
								searchQuery={chatSearchQuery}
								onSearchChange={handleSearchChange}
								selectedIntegrationKey={selectedIntegration?.key || undefined}
								status={status}
								isDisabled={
									selectedIntegration?.key
										? exportSupportMap[selectedIntegration.key] === false
										: false
								}
							/>
							<ChatViewSection />
						</div>

						<StatsSection />
					</div>
				)}
			</div>

			{/* Sync Chats Dialog */}
			<SyncChatsDialog
				isOpen={isSyncDialogOpen}
				onClose={() => {
					console.log("🔒 Closing sync dialog");
					setIsSyncDialogOpen(false);
				}}
				integrationKey={selectedIntegration?.key || null}
				integrationName={selectedIntegration?.name || undefined}
				onSyncSelected={handleSyncSelectedChats}
				selectedIntegration={selectedIntegration}
			/>

			{/* Integrations Dialog */}
			<IntegrationsDialog
				open={isIntegrationsDialogOpen}
				onOpenChange={setIsIntegrationsDialogOpen}
			/>

			{/* Delete Chat Dialog */}
			<DeleteChatDialog
				isOpen={isDeleteChatDialogOpen}
				onClose={() => setIsDeleteChatDialogOpen(false)}
				chatId={chatToDelete?.id || ""}
				chatName={chatToDelete?.name || ""}
				onDeleteSuccess={handleDeleteChatSuccess}
			/>
		</div>
	);
}
