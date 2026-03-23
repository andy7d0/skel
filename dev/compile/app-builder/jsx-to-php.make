rwildcard=$(foreach d,$(wildcard $(1:=/*)),$(call rwildcard,$d,$2) $(filter $(subst *,%,$2),$d))

JSX := $(patsubst ./%,%,$(call rwildcard,.,*.jsx))

TARGETS := $(JSX:%=%.done) 

EXISTS := $(patsubst ./%,%,$(call rwildcard,.,*.jsx.done))

#$(error $(filter-out $(TARGETS),$(EXISTS)))

MISSED := $(filter-out $(TARGETS),$(EXISTS))

#$(error $(MISSED))

all: $(TARGETS) $(MISSED)
	@find . -type d -empty -delete

$(MISSED) : FORCE
	rm $@

%.jsx.done : %.jsx
	@echo DO $<
	/build/build-jsx '<?php ' '$$⛑_[:METHOD:]([:BODY:] );' '$$⛑([:POSITIONS:]);' < $< > $@

.PHONY: all FORCE


