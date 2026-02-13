rwildcard=$(foreach d,$(wildcard $(1:=/*)),$(call rwildcard,$d,$2) $(filter $(subst *,%,$2),$d))


#DEPS:=$(GOPATH)/deps
#PLIGINS:=$(DIST)
# ENTRIES_SRC=$(call rwildcard,.,*.e.go)
# ENTRIES_SRC_TRIMMED=$(ENTRIES_SRC:./%=%)
# DEPFILES=$(ENTRIES_SRC_TRIMMED:%.e.go=$(DEPS)/%.d)

ALL_PHP:=$(patsubst ./%,%,$(call rwildcard,.,*.php))
EPHP:=$(filter *.e.php, $(ALL_PHP))
PHP:=$(filter-out *.e.php, $(ALL_PHP))


JSX:=$(patsubst ./%,%,$(call rwildcard,.,*.jsx))
JSON:=$(patsubst ./%,%,$(call rwildcard,.,*.json))
YML:=$(patsubst ./%,%,$(call rwildcard,.,*.yml))
TOML:=$(patsubst ./%,%,$(call rwildcard,.,*.toml))
TXT:=$(patsubst ./%,%,$(call rwildcard,.,*.txt))
MJS:=$(patsubst ./%,%,$(call rwildcard,.,*.cs.mjs))

EXISTS:=$(call rwildcard,$(DIST),*.php)
#$(error $(EXISTS))


#TARGETS=$(ENTRIES_SRC_TRIMMED:%.e.go=$(DIST)/%.so)

TARGETS=
TARGETS+= $(JSX:%=$(DIST)/%) 
TARGETS+= $(EPHP:%=$(DIST)/%) 
TARGETS+= $(PHP:%=$(DIST)/%) 
TARGETS+= $(YML:%=$(DIST)/%) 
TARGETS+= $(TOML:%=$(DIST)/%) 
TARGETS+= $(TXT:%=$(DIST)/%)
TARGETS+= $(MJS:%=$(DIST)/%)

all: $(TARGETS) pack

pack: $(TARGETS)
	@echo $(filter-out $^,$(EXISTS))


$(DIST)/%.jsx : %.jsx
	@mkdir -p $(dir $@)
	@cp $< $@
	@# todo builder

# COPY PLUGIN

$(DIST)/%.php : %.php
	@mkdir -p $(dir $@)
	@cp $< $@
$(DIST)/%.json : %.json
	@mkdir -p $(dir $@)
	@cp $< $@
$(DIST)/%.mjs : %.mjs
	@mkdir -p $(dir $@)
	@cp $< $@
$(DIST)/%.txt : %.txt
	@mkdir -p $(dir $@)
	@cp $< $@
$(DIST)/%.yml : %.yml
	@mkdir -p $(dir $@)
	@cp $< $@
$(DIST)/%.toml : %.toml
	@mkdir -p $(dir $@)
	@cp $< $@

.PHONY: all pack

# $(DIST)/%.so : %.e.go $(DEPS)/%.d
# 	@echo !!!!!!!!!! build $@ from $<
# 	go build -buildmode=plugin -o $@ $<
# 	#go list -deps $< 

# $(DEPFILES):
# include $(wildcard $(DEPFILES))


