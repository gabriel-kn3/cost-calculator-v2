CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Untitled Product' NOT NULL,
	`product_id` text,
	`state_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `fees` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`percentage` real DEFAULT 0 NOT NULL,
	`basis` text DEFAULT 'subtotal' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_cost` real DEFAULT 0 NOT NULL,
	`base_qty` real DEFAULT 1 NOT NULL,
	`unit` text,
	`supplier` text,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`is_common` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `materials_name_idx` ON `materials` (`name`);--> statement-breakpoint
CREATE INDEX `materials_common_idx` ON `materials` (`is_common`);--> statement-breakpoint
CREATE TABLE `product_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`material_id` text,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`supplier` text,
	`base_cost` real DEFAULT 0 NOT NULL,
	`base_qty` real DEFAULT 1 NOT NULL,
	`used_qty` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pm_product_idx` ON `product_materials` (`product_id`,`position`);--> statement-breakpoint
CREATE INDEX `pm_material_idx` ON `product_materials` (`material_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_norm` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`worked_hours` real DEFAULT 0 NOT NULL,
	`labor_rate` real DEFAULT 0 NOT NULL,
	`tax_percent` real DEFAULT 0 NOT NULL,
	`tax_basis` text DEFAULT 'subtotal' NOT NULL,
	`profit_percent` real DEFAULT 0 NOT NULL,
	`fees_json` text DEFAULT '[]' NOT NULL,
	`sale_price` real DEFAULT 0 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`totals_json` text DEFAULT '{}' NOT NULL,
	`photos_json` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_name_norm_uq` ON `products` (`name_norm`);--> statement-breakpoint
CREATE INDEX `products_updated_idx` ON `products` (`updated_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`user_agent` text,
	`ip` text
);
--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`labor_rate` real DEFAULT 12 NOT NULL,
	`tax_percent` real DEFAULT 7.5 NOT NULL,
	`tax_basis` text DEFAULT 'subtotal' NOT NULL,
	`profit_percent` real DEFAULT 20 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`currency_symbol` text DEFAULT '$' NOT NULL,
	`locale` text DEFAULT 'en-US' NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`session_minutes` integer DEFAULT 480 NOT NULL,
	`updated_at` text NOT NULL
);
