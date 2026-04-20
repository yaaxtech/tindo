-- Adiciona coluna ef (easiness factor) do algoritmo SM-2 adaptado.
-- Modula o intervalo de reexibição de tarefas adiadas.
ALTER TABLE tarefas
  ADD COLUMN ef numeric(3,2) NOT NULL DEFAULT 2.00
    CHECK (ef BETWEEN 1.30 AND 3.00);

COMMENT ON COLUMN tarefas.ef IS
  'Easiness factor (SM-2 adaptado). Cresce com adiamentos, decresce ao concluir. Modula intervalo da próxima adiada.';
