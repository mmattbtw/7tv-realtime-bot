import { AlternateMessageModifier, ChatClient } from "@kararty/dank-twitch-irc";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

interface EmoteEventUpdate {
  // The channel this update affects.
  channel: string;
  // The ID of the emote.
  emote_id: string;
  // The name or channel alias of the emote.
  name: string;
  // The action done.
  action: "ADD" | "REMOVE" | "UPDATE";
  // The user who caused this event to trigger.
  actor: string;
  // An emote object. Null if the action is "REMOVE".
  emote?: ExtraEmoteData;
}

interface ExtraEmoteData {
  // Original name of the emote.
  name: string;
  // The visibility bitfield of this emote.
  visibility: number;
  // The MIME type of the images.
  mime: string;
  // The TAGs on this emote.
  tags: string[];
  // The widths of the images.
  width: [number, number, number, number];
  // The heights of the images.
  height: [number, number, number, number];
  // The animation status of the emote.
  animated: boolean;
  // Infomation about the uploader.
  owner: {
    // 7TV ID of the owner.
    id: string;
    // Twitch ID of the owner.
    twitch_id: string;
    // Twitch DisplayName of the owner.
    display_name: string;
    // Twitch Login of the owner.
    login: string;
  };
  // The first string in the inner array will contain the "name" of the URL, like "1" or "2" or "3" or "4"
  // or some custom event names we haven't figured out yet such as "christmas_1" or "halloween_1" for special versions of emotes.
  // The second string in the inner array will contain the actual CDN URL of the emote. You should use these URLs and not derive URLs
  // based on the emote ID and size you want, since in future we might add "custom styles" and this will allow you to easily update your app,
  // and solve any future breaking changes you apps might receive due to us changing.
  urls: [[string, string]];
}

type banphraseResponse = {
  data: {
    banned: boolean;
    input_message: string;
    banphrase_data: {
      id: number;
      name: string;
      phrase: string;
      length: number;
      permanent: boolean;
      operator: string;
      case_sensitive: boolean;
    } | null;
  };
};

const banphraseUrls = {
  weest: "https://bot.weest.tv/api/v1/banphrases/test",
  mmattbtw: "https://mmattbot.com/api/v1/banphrases/test",
};

let client = new ChatClient({
  username: "emoteupdatebot",
  password: `${process.env.IRC_PASSWORD}`,
});

client.use(new AlternateMessageModifier(client));

client.on("ready", () => console.log("Connected to Twitch"));

client.on("close", (error) => {
  if (error != null) {
    console.error("Client closed due to error", error);
  }
});

async function sendMessage(message: string, channel: string) {
  if (channel === "weest" || channel === "mmattbtw") {
    const banphraseResponse: banphraseResponse = await axios.post(
      banphraseUrls[channel],
      { message }
    );

    if (!banphraseResponse.data.banned) {
      client.say(channel, message);
    } else {
      return;
    }
  } else {
    client.say(channel, message);
    return;
  }
}

import EventSource from "eventsource";

// dont hard code this
const source = new EventSource(
  "https://events.7tv.app/v1/channel-emotes?channel=weest&channel=mmattbtw"
);

source.addEventListener("ready", (e) => {
  // Should be "7tv-event-sub.v1" since this is the `v1` endpoint
  console.log(e.data);
});

source.addEventListener("update", async (e) => {
  // This is a JSON payload matching the type for the specified event channel
  const data = JSON.parse(e.data) as EmoteEventUpdate;

  switch (data.action) {
    case "ADD": {
      await sendMessage(
        `[NEW 7TV EMOTE]: ${data.actor} added ${data.name} `,
        data.channel
      );
      return;
    }

    case "REMOVE": {
      await sendMessage(
        `[7TV EMOTE REMOVED]: ${data.actor} removed ${data.name} `,
        data.channel
      );
      return;
    }

    case "UPDATE": {
      await sendMessage(
        `[7TV EMOTE UPDATED]: ${data.actor} aliased ${data.emote?.name} to ${data.name}`,
        data.channel
      );
      return;
    }
  }
});

source.addEventListener("open", (e) => {
  // Connection was opened.
  console.log(e);
});

client.connect();
// dont hardcode this
client.joinAll(["weest", "mmattbtw"]);
