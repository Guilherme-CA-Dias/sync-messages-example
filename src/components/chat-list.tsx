import { Chat } from "@/types/message";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Users } from "lucide-react";

interface ChatListProps {
	chats: Chat[];
	selectedChatId?: string;
	onChatSelect: (chatId: string) => void;
	isLoading?: boolean;
}

export function ChatList({
	chats,
	selectedChatId,
	onChatSelect,
	isLoading,
}: ChatListProps) {
	if (isLoading) {
		return (
			<div className="space-y-2">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="animate-pulse">
						<div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
					</div>
				))}
			</div>
		);
	}

	if (chats.length === 0) {
		return (
			<div className="text-center py-8">
				<MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
				<h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
					No chats found
				</h3>
				<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Connect to messaging platforms to see your chats here.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{chats.map((chat) => (
				<div
					key={chat.id}
					className={`p-4 rounded-lg cursor-pointer transition-colors ${
						selectedChatId === chat.id
							? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
							: "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
					}`}
					onClick={() => onChatSelect(chat.id)}
				>
					<div className="flex items-start justify-between">
						<div className="flex-1 min-w-0">
							<div className="flex items-center space-x-2">
								<MessageCircle className="h-4 w-4 text-gray-400" />
								<h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
									{chat.name}
								</h3>
							</div>

							{chat.participants.length > 0 && (
								<div className="flex items-center mt-1">
									<Users className="h-3 w-3 text-gray-400 mr-1" />
									<span className="text-xs text-gray-500 dark:text-gray-400">
										{chat.participants.length} participant
										{chat.participants.length !== 1 ? "s" : ""}
									</span>
								</div>
							)}

							{chat.lastMessage && (
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
									{chat.lastMessage}
								</p>
							)}
						</div>

						{chat.lastMessageTime &&
							(() => {
								try {
									const date = new Date(chat.lastMessageTime);
									if (isNaN(date.getTime())) {
										return null;
									}
									return (
										<div className="text-xs text-gray-400 ml-2">
											{formatDistanceToNow(date, {
												addSuffix: true,
											})}
										</div>
									);
								} catch (error) {
									console.error(
										"Error formatting chat time:",
										chat.lastMessageTime,
										error
									);
									return null;
								}
							})()}
					</div>

					{chat.platformName && (
						<div className="mt-2">
							<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
								{chat.platformName}
							</span>
						</div>
					)}
				</div>
			))}
		</div>
	);
}
