--
-- PostgreSQL database dump
--

\restrict

-- Dumped from database version 17.7 (Ubuntu 17.7-0ubuntu0.25.04.1)
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-0ubuntu0.25.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: kysely_migration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kysely_migration (
    name character varying(255) NOT NULL,
    "timestamp" character varying(255) NOT NULL
);


--
-- Name: kysely_migration_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kysely_migration_lock (
    id character varying(255) NOT NULL,
    is_locked integer DEFAULT 0 NOT NULL
);


--
-- Name: pre_alert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_alert (
    id integer NOT NULL,
    event_hash character varying(66) NOT NULL,
    json_data jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT '2026-06-14 19:46:28.26659'::timestamp without time zone,
    updated_at timestamp without time zone DEFAULT '2026-06-14 19:46:28.26659'::timestamp without time zone
);


--
-- Name: pre_alert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pre_alert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pre_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pre_alert_id_seq OWNED BY public.pre_alert.id;


--
-- Name: pre_alert_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_alert_source (
    pre_alert_id integer NOT NULL,
    source_id integer NOT NULL
);


--
-- Name: source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source (
    id integer NOT NULL,
    url character varying(500) NOT NULL,
    medium character varying(100),
    title character varying(500),
    published_at timestamp without time zone,
    fetched_at timestamp without time zone DEFAULT '2026-06-14 19:46:28.26659'::timestamp without time zone,
    content_hash character varying(66),
    raw_content text,
    clean_text text,
    metadata jsonb,
    is_relevant boolean,
    classification_reason text,
    detected_at timestamp without time zone
);


--
-- Name: source_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.source_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: source_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.source_id_seq OWNED BY public.source.id;


--
-- Name: pre_alert id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_alert ALTER COLUMN id SET DEFAULT nextval('public.pre_alert_id_seq'::regclass);


--
-- Name: source id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source ALTER COLUMN id SET DEFAULT nextval('public.source_id_seq'::regclass);


--
-- Name: kysely_migration_lock kysely_migration_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kysely_migration_lock
    ADD CONSTRAINT kysely_migration_lock_pkey PRIMARY KEY (id);


--
-- Name: kysely_migration kysely_migration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kysely_migration
    ADD CONSTRAINT kysely_migration_pkey PRIMARY KEY (name);


--
-- Name: pre_alert_source pk_pre_alert_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_alert_source
    ADD CONSTRAINT pk_pre_alert_source PRIMARY KEY (pre_alert_id, source_id);


--
-- Name: pre_alert pre_alert_event_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_alert
    ADD CONSTRAINT pre_alert_event_hash_key UNIQUE (event_hash);


--
-- Name: pre_alert pre_alert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_alert
    ADD CONSTRAINT pre_alert_pkey PRIMARY KEY (id);


--
-- Name: source source_content_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_content_hash_key UNIQUE (content_hash);


--
-- Name: source source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_pkey PRIMARY KEY (id);


--
-- Name: source source_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_url_key UNIQUE (url);


--
-- Name: idx_source_detected_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_detected_at ON public.source USING btree (detected_at);


--
-- Name: idx_source_is_relevant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_is_relevant ON public.source USING btree (is_relevant);


--
-- Name: idx_source_medium; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_medium ON public.source USING btree (medium);


--
-- Name: pre_alert_source fk_pre_alert_source_pre_alert; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_alert_source
    ADD CONSTRAINT fk_pre_alert_source_pre_alert FOREIGN KEY (pre_alert_id) REFERENCES public.pre_alert(id) ON DELETE CASCADE;


--
-- Name: pre_alert_source fk_pre_alert_source_source; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_alert_source
    ADD CONSTRAINT fk_pre_alert_source_source FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict

