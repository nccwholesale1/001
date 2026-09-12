ALTER TABLE `basket_lines` ADD `sku` text NOT NULL;--> statement-breakpoint
ALTER TABLE `baskets` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `baskets` ADD `order_request_id` text REFERENCES order_requests(id);--> statement-breakpoint
ALTER TABLE `order_request_lines` ADD `sku` text NOT NULL;