/**
 * One "Ir al himno" dialog for the whole app (hosted by the bottom
 * navigation): the # button, the hymn capsule and the G shortcut open it.
 */
export function useGoToHymn() {
  const open = useState<boolean>("go-to-hymn-open", () => false);
  return {
    open,
    show: () => (open.value = true),
  };
}
