import { redirect } from 'next/navigation';

/** /panel lleva a la primera sección disponible. */
export default function PanelHome() {
  redirect('/panel/tratamientos');
}
