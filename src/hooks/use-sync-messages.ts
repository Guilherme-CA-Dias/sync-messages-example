import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/fetch-utils";

interface ServerSyncStatus {
	isSyncing: boolean;
	lastSyncTime: string | null;
	status: "idle" | "pending" | "running" | "completed" | "failed";
	syncId?: string;
	error?: string;
	totalMessages?: number;
	totalChats?: number;
}

export function useSyncMessages() {
	const [syncStatus, setSyncStatus] = useState<ServerSyncStatus>({
		isSyncing: false,
		lastSyncTime: null,
		status: "idle",
	});

	// Fetch sync status from server
	const fetchSyncStatus = async () => {
		try {
			const response = await fetch("/api/sync-status", {
				headers: getAuthHeaders(),
			});

			if (response.ok) {
				const data = await response.json();
				setSyncStatus(data);
			}
		} catch (error) {
			console.error("Error fetching sync status:", error);
		}
	};

	// Poll for sync status updates when syncing
	useEffect(() => {
		if (!syncStatus.isSyncing) return;

		const interval = setInterval(() => {
			fetchSyncStatus();
		}, 2000); // Poll every 2 seconds

		return () => clearInterval(interval);
	}, [syncStatus.isSyncing]);

	// Initial fetch on mount
	useEffect(() => {
		fetchSyncStatus();
	}, []);

	const syncMessages = async () => {
		try {
			console.log("🔄 Starting sync...");

			// Step 1: Create sync status on server
			const createResponse = await fetch("/api/sync-status", {
				method: "POST",
				headers: getAuthHeaders(),
			});

			if (!createResponse.ok) {
				const errorData = await createResponse.json();
				if (createResponse.status === 409) {
					throw new Error("Sync already in progress");
				}
				throw new Error(errorData.error || "Failed to start sync");
			}

			const { syncId } = await createResponse.json();
			console.log("✅ Sync started with ID:", syncId);

			// Update local status
			setSyncStatus((prev) => ({
				...prev,
				isSyncing: true,
				status: "pending",
				syncId,
			}));

			// Step 2: Execute the actual sync
			const syncResponse = await fetch("/api/messages/sync", {
				method: "POST",
				headers: {
					...getAuthHeaders(),
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ syncId }),
			});

			if (!syncResponse.ok) {
				throw new Error("Failed to sync messages");
			}

			const result = await syncResponse.json();
			console.log("✅ Sync completed successfully:", result);

			// Step 3: Fetch final status
			await fetchSyncStatus();

			return result;
		} catch (error) {
			console.error("❌ Error syncing messages:", error);

			// Fetch updated status to reflect error
			await fetchSyncStatus();

			throw error;
		}
	};

	const clearSyncStatus = async () => {
		try {
			// This would require a DELETE endpoint, but for now we'll just fetch fresh status
			await fetchSyncStatus();
		} catch (error) {
			console.error("Error clearing sync status:", error);
		}
	};

	return {
		syncMessages,
		isSyncing: syncStatus.isSyncing,
		lastSyncTime: syncStatus.lastSyncTime,
		status: syncStatus.status,
		error: syncStatus.error,
		totalMessages: syncStatus.totalMessages,
		totalChats: syncStatus.totalChats,
		clearSyncStatus,
	};
}
