CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`detail_json` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_resource_idx` ON `audit_events` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `basket_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`basket_id` text NOT NULL,
	`shopify_variant_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`basket_id`) REFERENCES `baskets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `baskets` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_user_id` text,
	`contact_email` text,
	`contact_name` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `buyer_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `buyer_users` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'buyer' NOT NULL,
	`spend_limit_pence` integer,
	`status` text DEFAULT 'invited' NOT NULL,
	`shopify_customer_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_users_email_unique` ON `buyer_users` (`email`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`label` text NOT NULL,
	`address_line1` text NOT NULL,
	`address_line2` text,
	`city` text NOT NULL,
	`postcode` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guest_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_tokens_hash_unique` ON `guest_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`scope` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_keys_scope_key_unique` ON `idempotency_keys` (`scope`,`key`);--> statement-breakpoint
CREATE TABLE `order_request_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_request_id` text NOT NULL,
	`shopify_variant_id` text NOT NULL,
	`requested_quantity` integer NOT NULL,
	`confirmed_quantity` integer,
	`unit_price_pence` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_request_id`) REFERENCES `order_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_user_id` text,
	`guest_contact_email` text,
	`guest_contact_name` text,
	`status` text NOT NULL,
	`company_approved_by_buyer_user_id` text,
	`company_approved_at` text,
	`ncc_approved_by_staff_user_id` text,
	`ncc_approved_at` text,
	`cancelled_reason` text,
	`delivery_pence` integer,
	`vat_pence` integer,
	`final_total_pence` integer,
	`invoice_url` text,
	`internal_notes` text,
	`shopify_draft_order_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `buyer_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_approved_by_buyer_user_id`) REFERENCES `buyer_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ncc_approved_by_staff_user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quote_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`shopify_variant_id` text NOT NULL,
	`requested_quantity` integer NOT NULL,
	`quoted_unit_price_pence` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_user_id` text,
	`guest_contact_email` text,
	`guest_contact_name` text,
	`status` text NOT NULL,
	`issued_by_staff_user_id` text,
	`expires_at` text,
	`converted_order_request_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `buyer_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issued_by_staff_user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`converted_order_request_id`) REFERENCES `order_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `return_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`return_id` text NOT NULL,
	`order_request_line_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_request_line_id`) REFERENCES `order_request_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` text PRIMARY KEY NOT NULL,
	`order_request_id` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`rejection_reason` text,
	`resolution` text,
	`handled_by_staff_user_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_request_id`) REFERENCES `order_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by_staff_user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_rep_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_user_id` text NOT NULL,
	`company_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_rep_assignments_unique` ON `sales_rep_assignments` (`staff_user_id`,`company_id`);--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`staff_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_sessions_token_hash_unique` ON `staff_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `staff_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`employee_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_email_unique` ON `staff_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_username_unique` ON `staff_users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_employee_id_unique` ON `staff_users` (`employee_id`);--> statement-breakpoint
CREATE TABLE `support_ticket_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`support_ticket_id` text NOT NULL,
	`author_staff_user_id` text,
	`author_buyer_user_id` text,
	`is_internal_note` integer DEFAULT false NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`support_ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_staff_user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_buyer_user_id`) REFERENCES `buyer_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_user_id` text,
	`guest_contact_email` text,
	`category` text NOT NULL,
	`order_request_id` text,
	`return_id` text,
	`status` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `buyer_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_request_id`) REFERENCES `order_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON UPDATE no action ON DELETE no action
);
