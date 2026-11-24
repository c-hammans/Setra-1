import assert from "node:assert/strict";
import test from "node:test";
import { pushPrerequisiteState } from "./push-client.ts";

test("installed iPhone Home Screen apps can continue to the permission check", () => {
  assert.equal(pushPrerequisiteState({ secure: true, ios: true, standalone: true, supported: true }), null);
});

test("iPhone Safari explains that Home Screen installation is required", () => {
  assert.equal(pushPrerequisiteState({ secure: true, ios: true, standalone: false, supported: false }), "requires_install");
});

test("supported secure desktop browsers can continue to the permission check", () => {
  assert.equal(pushPrerequisiteState({ secure: true, ios: false, standalone: false, supported: true }), null);
});

test("unsupported and insecure browsers receive distinct states", () => {
  assert.equal(pushPrerequisiteState({ secure: true, ios: false, standalone: false, supported: false }), "unsupported");
  assert.equal(pushPrerequisiteState({ secure: false, ios: false, standalone: false, supported: true }), "insecure");
});
