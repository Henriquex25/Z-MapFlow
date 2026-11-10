package project

import (
	"fmt"
	"z-mapflow/internal/models"
)

func validateConditionalLayers(p models.Project) error {
	indices := map[string]int{}
	for i, l := range p.Layout.Layers {
		indices[l.ID] = i
	}
	targets := map[string]bool{}
	ids := map[string]bool{}
	for _, c := range p.Layout.ConditionalLayers {
		if !IDPattern.MatchString(c.ID) || ids[c.ID] || len(c.IfLayerIDs) == 0 || targets[c.ThenLayerID] {
			return fmt.Errorf("regra condicional inválida ou destino duplicado: %s", c.Name)
		}
		ids[c.ID] = true
		targets[c.ThenLayerID] = true
		then, ok := indices[c.ThenLayerID]
		if !ok {
			return fmt.Errorf("camada condicional não existe")
		}
		seen := map[string]bool{}
		for _, id := range c.IfLayerIDs {
			i, ok := indices[id]
			if !ok || i == then || seen[id] {
				return fmt.Errorf("%s: referência de camada inválida ou autorreferência", c.Name)
			}
			seen[id] = true
		}
	}
	graph := map[string][]string{}
	for _, c := range p.Layout.ConditionalLayers {
		graph[c.ThenLayerID] = c.IfLayerIDs
	}
	visiting, done := map[string]bool{}, map[string]bool{}
	var visit func(string) error
	visit = func(id string) error {
		if visiting[id] {
			return fmt.Errorf("ciclo entre camadas condicionais")
		}
		if done[id] {
			return nil
		}
		visiting[id] = true
		for _, dep := range graph[id] {
			if err := visit(dep); err != nil {
				return err
			}
		}
		visiting[id] = false
		done[id] = true
		return nil
	}
	for id := range graph {
		if err := visit(id); err != nil {
			return err
		}
	}
	return nil
}
