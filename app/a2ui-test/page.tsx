"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const A2UIAnswer = dynamic(() => import("@/components/chat/A2UIAnswer"), {
  ssr: false,
});

const valid =
  '{"version":"1.0","createSurface":{"surfaceId":"sando-chat","catalogId":"https://sando.app/catalogs/chat/v1/catalog.json","components":[{"id":"root","component":"Column","children":["title","body","go"]},{"id":"title","component":"Text","text":"Hello","variant":"body"},{"id":"body","component":"Text","text":"This is a test.","variant":"body"},{"id":"go","component":"Button","child":"goLabel","action":{"event":{"name":"ok"}}},{"id":"goLabel","component":"Text","text":"Go","variant":"body"}]}}';

const form =
  '{"version":"1.0","createSurface":{"surfaceId":"sando-chat","catalogId":"https://sando.app/catalogs/chat/v1/catalog.json","components":[{"id":"root","component":"Column","children":["nameField","picker"]},{"id":"nameField","component":"TextField","label":"Your name","value":{"@path":"/name"},"variant":"shortText"},{"id":"picker","component":"ChoicePicker","label":"Pick one","options":[{"label":"One","value":"one"},{"label":"Two","value":"two"}],"value":{"@path":"/pick"},"variant":"mutuallyExclusive"}],"dataModel":{"name":"","pick":[]}}}';

const hyphen =
  '{"version":"1.0","createSurface":{"surfaceId":"sando-chat","catalogId":"https://sando.app/catalogs/chat/v1/catalog.json","components":[{"id":"root","component":"Column","children":["title-one"]},{"id":"title-one","component":"Text","text":"Hyphen id"}]}}';

export default function Page() {
  const [followUp, setFollowUp] = useState("");
  return (
    <main style={{ background: "black", color: "white", padding: 24 }}>
      <h1>valid</h1>
      <div id="valid">
        <A2UIAnswer messages={valid} onFollowUp={setFollowUp} />
      </div>
      <h1>form</h1>
      <div id="form">
        <A2UIAnswer
          messages={form}
          onStateUpdate={(s) => setFollowUp(JSON.stringify(s))}
          onFollowUp={setFollowUp}
        />
      </div>
      <h1>hyphen</h1>
      <div id="hyphen">
        <A2UIAnswer messages={hyphen} onFollowUp={setFollowUp} />
      </div>
      <pre id="follow-up">{followUp}</pre>
    </main>
  );
}
