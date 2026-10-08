export function filterSuppliers(suppliers, filters) {
  const search = filters.search.trim().toLocaleLowerCase('es')
  return suppliers.filter(supplier => {
    const haystack = `${supplier.name} ${supplier.contact_person} ${supplier.phone} ${supplier.email} ${supplier.notes}`.toLocaleLowerCase('es')
    return (!search || haystack.includes(search))
      && (!filters.trade || supplier.trade === filters.trade)
      && (!filters.status || supplier.status === filters.status)
  })
}
