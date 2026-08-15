import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dashboardKeys } from "@/features/dashboard/queries";
import type {
	UpdateSettingsInput,
	UserSettings,
} from "@/features/settings/api";
import { settingsApi } from "@/features/settings/api";
import type { HttpError } from "../shared/http";
import { settingsKeys } from "./queries";

export function useUpdateSettings() {
	const queryClient = useQueryClient();

	return useMutation<UserSettings, HttpError, UpdateSettingsInput>({
		mutationFn: (input) => settingsApi.update(input),
		onSuccess: (row) => {
			queryClient.setQueryData(settingsKeys.all, row);
			// base currency / monthly budget both feed the dashboard summary.
			queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
		},
		onError: (err) => {
			toast.error(err.status < 500 ? err.message : "Failed to save settings");
		},
	});
}
