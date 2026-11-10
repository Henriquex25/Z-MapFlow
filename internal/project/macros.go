package project

import (
	"fmt"
	"strconv"
	"strings"
	"z-mapflow/internal/models"
)

var MacroControls = map[string]int{"macro_tap": 0, "macro_press": 0, "macro_release": 0, "macro_pause_for_release": 0, "macro_wait_time": 1, "macro_tap_time": 1, "macro_param_1to1": 0, "macro_param_1to2": 0, "macro_param_2to1": 0, "macro_param_2to2": 0}

// MacroBindings serializes explicit modes and native controls. A delay queues a
// single no-op press; it has no tap duration and restores the preceding state.
func MacroBindings(m models.Macro) ([]string, error) {
	pending := map[int]bool{}
	for _, s := range m.Steps {
		if s.Kind == "control" {
			var from, to int
			if _, e := fmt.Sscanf(s.Binding, "&macro_param_%dto%d", &from, &to); e == nil {
				pending[to] = true
			}
			continue
		}
		if s.Kind == "wait" {
			if len(pending) > 0 {
				return nil, fmt.Errorf("coloque o roteamento de parâmetros depois da espera")
			}
			continue
		}
		f, e := BindingParts(s.Binding)
		if e != nil {
			return nil, e
		}
		for to := range pending {
			if to >= len(f) {
				return nil, fmt.Errorf("a ação %s não recebe o argumento %d", s.Binding, to)
			}
		}
		for i, arg := range f[1:] {
			if arg == "MACRO_PLACEHOLDER" && !pending[i+1] {
				return nil, fmt.Errorf("MACRO_PLACEHOLDER sem roteamento em %s", s.Binding)
			}
		}
		pending = map[int]bool{}
	}
	if len(pending) > 0 {
		return nil, fmt.Errorf("roteamento de parâmetros sem ação de destino")
	}
	result := []string{}
	mode := "tap"
	wait := m.WaitMs
	for _, s := range m.Steps {
		switch s.Kind {
		case "tap", "press", "release":
			if mode != s.Kind {
				result = append(result, "&macro_"+s.Kind)
				mode = s.Kind
			}
			result = append(result, s.Binding)
		case "binding":
			result = append(result, s.Binding)
		case "control":
			f, e := BindingParts(s.Binding)
			if e != nil {
				return nil, e
			}
			name := strings.TrimPrefix(f[0], "&")
			arity, ok := MacroControls[name]
			if !ok || len(f) != arity+1 {
				return nil, fmt.Errorf("controle de macro inválido: %s", s.Binding)
			}
			if strings.HasPrefix(name, "macro_param_") {
				from := int(name[len("macro_param_")] - '0')
				if from > m.ParameterCount {
					return nil, fmt.Errorf("%s requer %d parâmetros na macro", s.Binding, from)
				}
			}
			if arity == 1 {
				ms, e := strconv.Atoi(f[1])
				if e != nil || ms < 0 || ms > 60000 {
					return nil, fmt.Errorf("tempo inválido: %s", s.Binding)
				}
				if name == "macro_wait_time" {
					wait = ms
				}
			}
			if name == "macro_tap" || name == "macro_press" || name == "macro_release" {
				mode = strings.TrimPrefix(name, "macro_")
			}
			result = append(result, strings.Join(f, " "))
		case "wait":
			if s.DurationMs < 0 || s.DurationMs > 60000 {
				return nil, fmt.Errorf("espera inválida")
			}
			result = append(result, fmt.Sprintf("&macro_wait_time %d", s.DurationMs), "&macro_press", "&none", fmt.Sprintf("&macro_wait_time %d", wait), "&macro_"+mode)
		default:
			return nil, fmt.Errorf("passo de macro inválido: %s", s.Kind)
		}
	}
	if len(result) > 256 {
		return nil, fmt.Errorf("macro %s gera %d bindings; o ZMK permite até 256. Divida-a em macros menores", m.Name, len(result))
	}
	return result, nil
}

// MacroQueueSize includes nested macros and explicit no-ops. Cycle validation
// runs first; memoization keeps shared compositions inexpensive.
func MacroQueueSize(p models.Project) int {
	memo := map[string]int{}
	visiting := map[string]bool{}
	var count func(string) int
	count = func(id string) int {
		if v, ok := memo[id]; ok {
			return v
		}
		if visiting[id] {
			return 0
		}
		visiting[id] = true
		for _, m := range p.Layout.Macros {
			if m.ID == id {
				bindings, _ := MacroBindings(m)
				events := 0
				mode := "tap"
				for _, code := range bindings {
					f := strings.Fields(code)
					if len(f) == 0 {
						continue
					}
					name := strings.TrimPrefix(f[0], "&")
					if _, ok := MacroControls[name]; ok {
						if name == "macro_tap" || name == "macro_press" || name == "macro_release" {
							mode = strings.TrimPrefix(name, "macro_")
						}
						continue
					}
					n := 1
					if mode == "tap" {
						n = 2
					}
					events += n + count(name)
					if events > 32768 {
						events = 32768
						break
					}
				}
				memo[id] = events
				delete(visiting, id)
				return events
			}
		}
		for _, b := range p.Layout.Behaviors {
			if BehaviorReference(b) == id {
				largest := 0
				for _, code := range b.Bindings {
					f := strings.Fields(code)
					if len(f) > 0 {
						if n := count(strings.TrimPrefix(f[0], "&")); n > largest {
							largest = n
						}
					}
				}
				memo[id] = largest
				delete(visiting, id)
				return largest
			}
		}
		delete(visiting, id)
		return 0
	}
	max := 64
	for _, m := range p.Layout.Macros {
		if n := count(m.ID) + 16; n > max {
			max = n
		}
	}
	return max
}
