CREATE TABLE "api_rate_limit" (
	"key_id" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "api_rate_limit_key_id_window_start_pk" PRIMARY KEY("key_id","window_start")
);
