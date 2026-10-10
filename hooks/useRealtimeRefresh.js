import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { supabase } from "../lib/supabase";

export default function useRealtimeRefresh({
  channelName,
  subscriptions,
  onChange,
  enabled = true,
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const subscriptionsKey = JSON.stringify(subscriptions);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let timer = null;
    let hasConnectedBefore = false;

    function scheduleRefresh() {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        onChangeRef.current();
      }, 250);
    }

    let channel = supabase.channel(channelName);

    JSON.parse(subscriptionsKey).forEach(({ table, filter }) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        scheduleRefresh
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (hasConnectedBefore) {
          scheduleRefresh();
        }
        hasConnectedBefore = true;
      }
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        scheduleRefresh();
      }
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      appStateSubscription.remove();
      supabase.removeChannel(channel);
    };
  }, [channelName, subscriptionsKey, enabled]);
}