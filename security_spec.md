# Security Specification: Firestore Fortress Rules

This specification establishes the data invariants, threat model payloads, and test requirements for protecting the `studio_creations` and `user_memories` collections.

## 1. Data Invariants

### A. Studio Creations
- **Ownership**: Every asset must have a `userId` property that exactly matches the authenticated user (`request.auth.uid`).
- **Type Bounds**: The asset `type` must be strictly restricted to `"image"`, `"video"`, or `"music"`.
- **Integrity**: Once created, `userId` and `createdAt` are completely immutable.

### B. User Memories
- **Ownership**: Every memory must have a `userId` property that exactly matches the authenticated user (`request.auth.uid`).
- **Category Validation**: The memory `category` must be one of `"identity"`, `"preference"`, `"goal"`, `"project"`, `"relationship"`, `"emotional"`, or `"behavior"`.
- **Size Limit**: Memory text strings must be constrained to a reasonable size (e.g., maximum 5000 characters) to prevent database resource exhaustion attacks.
- **Integrity**: Once created, the `userId` is immutable.

---

## 2. The "Dirty Dozen" Payloads

The following 12 adversarial payloads attempt to break the rules of Identity, Integrity, and State. All of these MUST return `PERMISSION_DENIED`.

### Pillar 1: Identity Spoofing (Adversary writing onto another user's resources)
1. **Payload 1**: Creating a studio asset where `userId` is set to `"victim_uid"` instead of `"adversary_uid"`.
2. **Payload 2**: Creating a user memory where `userId` is set to `"victim_uid"` instead of `"adversary_uid"`.

### Pillar 2: Privilege Escalation & Role Hijack (Attempting to bypass auth checks)
3. **Payload 3**: Unauthenticated read request to list `user_memories`.
4. **Payload 4**: Unauthenticated write request to create a studio asset.

### Pillar 3: Resource Poisoning & Denial of Wallet (Junk or bloated data injection)
5. **Payload 5**: Injecting a 2MB random text string as the `text` of a user memory.
6. **Payload 6**: Creating an invalid asset type (e.g., `"type": "executable"`).
7. **Payload 7**: Injecting junk characters as document path ID (e.g., `{memoryId}` being a 1.5KB string of emojis).

### Pillar 4: Immutable Violation (Attempting to update fields that should never change)
8. **Payload 8**: Updating a studio asset to change `userId` from `"owner_uid"` to `"new_owner_uid"`.
9. **Payload 9**: Modifying a memory's `createdAt` timestamp to point to a date in the past.

### Pillar 5: Schema Corruption & Shadow Fields (Injecting un-validated data properties)
10. **Payload 10**: Creating a memory document containing a shadow field `"isVerifiedAdmin": true` not present in the schema.
11. **Payload 11**: Creating a studio asset with missing required fields (e.g., omitting `assetData`).

### Pillar 6: Temporal Integrity Hijack (Faking timestamps)
12. **Payload 12**: Setting `createdAt` or `updatedAt` to a client-side falsified timestamp rather than `request.time`.
