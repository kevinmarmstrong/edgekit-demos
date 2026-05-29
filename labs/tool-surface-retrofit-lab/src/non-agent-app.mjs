const seedWorkOrders = [
  {
    id: 'WO-1042',
    title: 'Water leak at East Lofts',
    building: 'East Lofts',
    unit: '4B',
    reportedBy: 'tenant-app',
    priority: 'normal',
    requiredSkill: 'plumbing',
    tenantImpact: 'active leak into occupied unit; tenant cannot use kitchen sink',
    requestedWindow: 'today',
    assignment: null,
  },
  {
    id: 'WO-1043',
    title: 'Lobby light replacement',
    building: 'North Arcade',
    unit: 'Lobby',
    reportedBy: 'front-desk',
    priority: 'low',
    requiredSkill: 'electrical',
    tenantImpact: 'cosmetic; alternate fixtures available',
    requestedWindow: 'this-week',
    assignment: null,
  },
]

const seedTechnicians = [
  {
    id: 'TECH-PLUMBING-1',
    name: 'Mina Patel',
    skills: ['plumbing', 'water-mitigation'],
    windows: ['today-2pm-4pm', 'tomorrow-9am-11am'],
  },
  {
    id: 'TECH-ELECTRICAL-1',
    name: 'Jon Okafor',
    skills: ['electrical'],
    windows: ['tomorrow-1pm-3pm'],
  },
]

function clone(value) {
  return value == null ? value : structuredClone(value)
}

export function createDispatchBoardApp(seed = {}) {
  const workOrders = new Map((seed.workOrders ?? seedWorkOrders).map((order) => [order.id, clone(order)]))
  const technicians = new Map((seed.technicians ?? seedTechnicians).map((tech) => [tech.id, clone(tech)]))
  const hostAudit = []

  const selectors = {
    listOpenWorkOrders() {
      return [...workOrders.values()].filter((order) => !order.assignment).map(clone)
    },
    getWorkOrder(id) {
      const order = workOrders.get(id)
      if (!order) throw new Error(`Unknown work order ${id}`)
      return clone(order)
    },
    listTechnicians({ skill } = {}) {
      return [...technicians.values()]
        .filter((tech) => !skill || tech.skills.includes(skill))
        .map(clone)
    },
  }

  const actions = {
    scheduleSameDayVisit({ workOrderId, technicianId, window, approvalId }) {
      if (!approvalId) throw new Error('host action rejected: approvalId is required for same-day scheduling')
      const order = workOrders.get(workOrderId)
      if (!order) throw new Error(`Unknown work order ${workOrderId}`)
      const technician = technicians.get(technicianId)
      if (!technician) throw new Error(`Unknown technician ${technicianId}`)
      if (!technician.windows.includes(window)) throw new Error(`${technician.name} is not available for ${window}`)
      if (!technician.skills.includes(order.requiredSkill)) throw new Error(`${technician.name} lacks ${order.requiredSkill}`)

      order.priority = 'urgent'
      order.assignment = {
        technicianId,
        technicianName: technician.name,
        window,
        approvalId,
      }

      hostAudit.push({
        action: 'scheduleSameDayVisit',
        adapter: 'host.actions.scheduleSameDayVisit',
        workOrderId,
        technicianId,
        window,
        approvalId,
        timestamp: new Date().toISOString(),
      })

      return clone(order)
    },
  }

  return {
    selectors,
    actions,
    audit() {
      return hostAudit.map(clone)
    },
  }
}
